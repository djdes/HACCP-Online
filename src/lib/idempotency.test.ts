import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  IN_FLIGHT_STATUS,
  claimIdempotency,
  journalIdempotencyKey,
  type IdempotencyStore,
  type StoredResponse,
} from "@/lib/idempotency";

/** Хранилище в памяти с тем же поведением, что и таблица: `key` уникален. */
function memoryStore(seed: Record<string, StoredResponse> = {}) {
  const rows = new Map<string, StoredResponse>(Object.entries(seed));
  const store: IdempotencyStore & { rows: Map<string, StoredResponse> } = {
    rows,
    async create(row) {
      if (rows.has(row.key)) throw new Error("duplicate key");
      rows.set(row.key, { httpStatus: row.httpStatus, response: row.response });
    },
    async find(key) {
      return rows.get(key) ?? null;
    },
    async complete(key, value) {
      rows.set(key, value);
    },
    async release(key) {
      rows.delete(key);
    },
  };
  return store;
}

const ARGS = {
  key: "journal:u1:abc12345",
  organizationId: "org-1",
  journalCode: "temp_control",
};

describe("claimIdempotency", () => {
  it("свободный ключ — работу выполняем", async () => {
    const store = memoryStore();
    const result = await claimIdempotency(store, ARGS);
    assert.deepEqual(result, { kind: "proceed" });
    // Бронь должна остаться в хранилище, иначе параллельный повтор
    // проскочит следом и запишет второй раз.
    assert.equal(store.rows.get(ARGS.key)?.httpStatus, IN_FLIGHT_STATUS);
  });

  it("повтор, пока первая попытка ещё выполняется — не дублируем", async () => {
    // Ровно тот случай, ради которого всё написано: radio отвалился, пока
    // сервер обрабатывал, retryFetch отправил вторую попытку.
    const store = memoryStore();
    await claimIdempotency(store, ARGS);
    const second = await claimIdempotency(store, ARGS);
    assert.deepEqual(second, { kind: "in_flight" });
  });

  it("повтор после успеха — отдаём тот же ответ", async () => {
    const store = memoryStore();
    await claimIdempotency(store, ARGS);
    await store.complete(ARGS.key, {
      httpStatus: 200,
      response: { entry: { id: "e1" } },
    });

    const again = await claimIdempotency(store, ARGS);
    assert.equal(again.kind, "replay");
    assert.deepEqual(
      again.kind === "replay" ? again.stored : null,
      { httpStatus: 200, response: { entry: { id: "e1" } } },
      "человек должен получить id той же записи, а не новой",
    );
  });

  it("после снятия брони запись можно отправить снова", async () => {
    // Первая попытка упала на середине — вторая обязана пройти, иначе
    // человек заперт с заполненной формой.
    const store = memoryStore();
    await claimIdempotency(store, ARGS);
    await store.release(ARGS.key);
    assert.deepEqual(await claimIdempotency(store, ARGS), { kind: "proceed" });
  });

  it("разные ключи не мешают друг другу", async () => {
    const store = memoryStore();
    await claimIdempotency(store, ARGS);
    const other = await claimIdempotency(store, {
      ...ARGS,
      key: "journal:u1:zzz99999",
    });
    assert.deepEqual(other, { kind: "proceed" });
  });

  it("хранилище недоступно — запись пропускаем, а не теряем", async () => {
    // Отказать здесь означало бы потерять уже заполненную работником
    // форму из-за подстраховки. Риск дубля меньше риска потери.
    const broken: IdempotencyStore = {
      async create() {
        throw new Error("db down");
      },
      async find() {
        throw new Error("db down");
      },
      async complete() {},
      async release() {},
    };
    assert.deepEqual(await claimIdempotency(broken, ARGS), { kind: "proceed" });
  });
});

describe("journalIdempotencyKey", () => {
  it("ключ привязан к пользователю", () => {
    // Иначе один человек мог бы «занять» ключ другого и получить в
    // ответ чужую запись.
    assert.equal(
      journalIdempotencyKey("u1", "abcdef123456"),
      "journal:u1:abcdef123456",
    );
    assert.notEqual(
      journalIdempotencyKey("u1", "abcdef123456"),
      journalIdempotencyKey("u2", "abcdef123456"),
    );
  });

  it("короткий и пустой ключ отвергаем", () => {
    // Угадываемый ключ — это чтение чужого ответа.
    assert.equal(journalIdempotencyKey("u1", ""), null);
    assert.equal(journalIdempotencyKey("u1", "  "), null);
    assert.equal(journalIdempotencyKey("u1", "1234567"), null);
  });

  it("длинный ключ обрезаем, а не отвергаем", () => {
    const key = journalIdempotencyKey("u1", "x".repeat(500));
    assert.ok(key);
    assert.ok(key.length <= "journal:u1:".length + 120);
  });

  it("не пересекается с ключами внешнего API", () => {
    // Внешний API кладёт в ту же таблицу ключи вида `<tokenHint>:<key>`.
    const key = journalIdempotencyKey("u1", "abcdef123456");
    assert.ok(key?.startsWith("journal:"));
  });
});
