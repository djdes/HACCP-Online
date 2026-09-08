/**
 * Политика очереди заявок Ветис.
 *
 * Смысл файла — в ветке «двойное гашение». Остальные проверки обычные,
 * а эта закрывает единственный сценарий интеграции, где ошибка стоит
 * дорого: повторно погашенный ВСД откатить нельзя.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MercuryError } from "@/lib/mercury/errors";
import {
  decideAfterStatusCheck,
  decideOutboxOutcome,
  MAX_ATTEMPTS,
  MAX_POLLS,
  type OutboxRow,
} from "@/lib/mercury/outbox-policy";

const NOW = new Date("2026-09-08T12:00:00Z");

function row(over: Partial<OutboxRow> = {}): OutboxRow {
  return {
    action: "getVetDocumentList",
    status: "submitted",
    attempts: 0,
    pollAttempts: 0,
    applicationId: "app-1",
    submittedAt: new Date("2026-09-08T11:59:00Z"),
    ...over,
  };
}

const command = (over: Partial<OutboxRow> = {}) =>
  row({ action: "processIncomingConsignment", ...over });

describe("decideOutboxOutcome", () => {
  it("успешная отправка запоминает id заявки", () => {
    const d = decideOutboxOutcome(
      row({ status: "pending", applicationId: null, submittedAt: null }),
      { kind: "submitted", applicationId: "app-42" },
      NOW,
    );
    assert.deepEqual(d, { next: "submitted", applicationId: "app-42" });
  });

  it("завершённая заявка закрывается", () => {
    const d = decideOutboxOutcome(row(), { kind: "completed", resultXml: "<x/>" }, NOW);
    assert.equal(d.next, "delivered");
  });

  it("заявка ещё в работе — просто ждём", () => {
    const d = decideOutboxOutcome(row(), { kind: "inProcess" }, NOW);
    assert.equal(d.next, "retry");
  });

  it("бесконечно висящая заявка в итоге признаётся провалом", () => {
    const d = decideOutboxOutcome(
      row({ pollAttempts: MAX_POLLS }),
      { kind: "inProcess" },
      NOW,
    );
    assert.equal(d.next, "failed");
  });

  describe("защита от двойного гашения", () => {
    it("«ВСД уже погашен» — это УСПЕХ, а не ошибка", () => {
      const error = new MercuryError("app_rejected", "ВСД уже погашен", {
        appErrorCodes: ["MERC10005"],
      });
      const d = decideOutboxOutcome(command(), { kind: "error", error }, NOW);
      assert.equal(d.next, "delivered");
    });

    it("протухшая КОМАНДА идёт на проверку статуса, а не на слепой повтор", () => {
      const d = decideOutboxOutcome(
        command({ submittedAt: new Date("2026-09-04T10:00:00Z") }),
        { kind: "inProcess" },
        NOW,
      );
      assert.equal(
        d.next,
        "verify",
        "иначе рискуем погасить ВСД второй раз",
      );
    });

    it("протухшее ЧТЕНИЕ можно спокойно переотправить", () => {
      const d = decideOutboxOutcome(
        row({ submittedAt: new Date("2026-09-04T10:00:00Z") }),
        { kind: "inProcess" },
        NOW,
      );
      assert.equal(d.next, "resubmit");
    });

    it("если ВСД уже не CONFIRMED — считаем, что команда дошла", () => {
      assert.equal(decideAfterStatusCheck("UTILIZED").next, "delivered");
      assert.equal(decideAfterStatusCheck("WITHDRAWN").next, "delivered");
    });

    it("ВСД всё ещё CONFIRMED — повторяем осознанно", () => {
      assert.equal(decideAfterStatusCheck("CONFIRMED").next, "resubmit");
    });
  });

  describe("ошибки", () => {
    it("сеть — повторяем", () => {
      const d = decideOutboxOutcome(
        row(),
        { kind: "error", error: new MercuryError("network", "таймаут") },
        NOW,
      );
      assert.equal(d.next, "retry");
    });

    it("5xx — повторяем, 4xx — нет", () => {
      const server = decideOutboxOutcome(
        row(),
        { kind: "error", error: new MercuryError("http", "500", { httpStatus: 502 }) },
        NOW,
      );
      assert.equal(server.next, "retry");

      const client = decideOutboxOutcome(
        row(),
        { kind: "error", error: new MercuryError("http", "400", { httpStatus: 400 }) },
        NOW,
      );
      assert.equal(client.next, "failed");
    });

    it("SOAP Fault и бизнес-отказ не повторяются", () => {
      for (const kind of ["soap_fault", "app_rejected", "parse", "config"] as const) {
        const d = decideOutboxOutcome(
          row(),
          { kind: "error", error: new MercuryError(kind, "нет") },
          NOW,
        );
        assert.equal(d.next, "failed", kind);
      }
    });

    it("исчерпание попыток закрывает заявку", () => {
      const d = decideOutboxOutcome(
        row({ attempts: MAX_ATTEMPTS - 1 }),
        { kind: "error", error: new MercuryError("network", "таймаут") },
        NOW,
      );
      assert.equal(d.next, "failed");
      assert.match(String((d as { reason: string }).reason), /попыток/);
    });

    it("неизвестная ошибка не уходит в бесконечный повтор", () => {
      const d = decideOutboxOutcome(
        command(),
        { kind: "error", error: new Error("что-то странное") },
        NOW,
      );
      assert.equal(d.next, "failed");
    });
  });
});
