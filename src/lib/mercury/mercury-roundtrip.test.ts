/**
 * Сквозной прогон протокола Ветис.API на моке.
 *
 * Проверяем ровно то, что нельзя проверить по кускам: боевой клиент
 * собирает XML → мок отвечает в формате шлюза → боевой парсер его
 * разбирает. Если сойдутся все три, то с приходом настоящих доступов
 * калибровать останется только имена namespace'ов и набор полей.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MercuryClient } from "@/lib/mercury/client";
import { isAlreadyProcessedError, MercuryError } from "@/lib/mercury/errors";
import { MockTransport } from "@/lib/mercury/mock-transport";
import { MockMercuryStore } from "@/lib/mercury/mock/store";

const ENTERPRISE = "ent-guid-0001";

function makeClient(store = new MockMercuryStore()) {
  const client = new MercuryClient({
    apiKey: "test-key",
    issuerGuid: "issuer-guid-0001",
    environment: "test",
    mode: "mock",
    transport: new MockTransport(store),
  });
  return { client, store };
}

/** Мок отдаёт IN_PROCESS на первый опрос — крутим до готовности. */
async function pollUntilDone(
  client: MercuryClient,
  applicationId: string,
  maxPolls = 5,
) {
  for (let i = 0; i < maxPolls; i += 1) {
    const result = await client.receive(applicationId);
    if (result.status === "COMPLETED") return result;
  }
  throw new Error("заявка так и не завершилась");
}

describe("Ветис.API: сквозной цикл", () => {
  it("заявка не готова с первого опроса — протокол правда двухфазный", async () => {
    const { client } = makeClient();
    const submitted = await client.submitGetVetDocumentList({
      enterpriseGuid: ENTERPRISE,
    });
    assert.equal(submitted.status, "ACCEPTED");
    assert.ok(submitted.applicationId);

    const first = await client.receive(submitted.applicationId);
    assert.equal(first.status, "IN_PROCESS");

    const second = await client.receive(submitted.applicationId);
    assert.equal(second.status, "COMPLETED");
  });

  it("список входящих ВСД разбирается боевым парсером", async () => {
    const { client } = makeClient();
    const submitted = await client.submitGetVetDocumentList({
      enterpriseGuid: ENTERPRISE,
    });
    const result = await pollUntilDone(client, submitted.applicationId);

    const parsed = MercuryClient.parseResult(
      "getVetDocumentList",
      result.xml,
    );
    assert.equal(parsed.kind, "vetDocumentList");
    if (parsed.kind !== "vetDocumentList") return;

    assert.ok(parsed.page.documents.length > 0, "мок обязан засеять ВСД");
    const doc = parsed.page.documents[0];
    assert.equal(doc.consigneeEnterpriseGuid, ENTERPRISE);
    assert.equal(doc.status, "CONFIRMED");
    assert.ok(doc.productName, "название продукции");
    assert.ok(doc.consignorName, "поставщик");
    assert.ok(doc.expiryDate, "срок годности");
    assert.ok(doc.accompanyingDocs, "сопроводительные документы");
    // Номер партии обязан остаться строкой: «007» не должен стать 7.
    assert.equal(typeof doc.batchNumber, "string");
  });

  it("гашение переводит ВСД в UTILIZED и отдаёт запись склада", async () => {
    const { client, store } = makeClient();
    store.seedIncoming(ENTERPRISE, 2);
    const [doc] = store.listIncoming(ENTERPRISE);

    const submitted = await client.submitProcessIncomingConsignment({
      vetDocumentUuid: doc.uuid,
      enterpriseGuid: ENTERPRISE,
      initiatorLogin: "ivanova",
      decision: "ACCEPT",
      transportConditionOk: true,
      packagingOk: true,
      documentsOk: true,
      productTemperature: "+4",
    });
    const result = await pollUntilDone(client, submitted.applicationId);

    const parsed = MercuryClient.parseResult(
      "processIncomingConsignment",
      result.xml,
    );
    assert.equal(parsed.kind, "processIncoming");
    if (parsed.kind !== "processIncoming") return;
    assert.ok(parsed.stockEntryGuid, "гашение возвращает guid записи склада");
    assert.equal(store.getDocument(doc.uuid)?.status, "UTILIZED");
  });

  it("повторное гашение читается как «уже погашен», а не как провал", async () => {
    const { client, store } = makeClient();
    store.seedIncoming(ENTERPRISE, 1);
    const [doc] = store.listIncoming(ENTERPRISE);

    const first = await client.submitProcessIncomingConsignment({
      vetDocumentUuid: doc.uuid,
      enterpriseGuid: ENTERPRISE,
      initiatorLogin: "ivanova",
      decision: "ACCEPT",
      transportConditionOk: true,
      packagingOk: true,
      documentsOk: true,
    });
    await pollUntilDone(client, first.applicationId);

    const second = await client.submitProcessIncomingConsignment({
      vetDocumentUuid: doc.uuid,
      enterpriseGuid: ENTERPRISE,
      initiatorLogin: "ivanova",
      decision: "ACCEPT",
      transportConditionOk: true,
      packagingOk: true,
      documentsOk: true,
    });

    // Это ГЛАВНАЯ защита от двойного гашения: ошибку «уже погашен»
    // очередь обязана трактовать как успех, иначе повтор после падения
    // крона пометит документ как проблемный на ровном месте.
    await assert.rejects(
      () => pollUntilDone(client, second.applicationId),
      (error: unknown) => {
        assert.ok(error instanceof MercuryError);
        assert.equal(error.kind, "app_rejected");
        assert.ok(
          isAlreadyProcessedError(error),
          `ошибка должна опознаваться как «уже погашен»: ${(error as Error).message}`,
        );
        return true;
      },
    );
  });

  it("исчезнувшая заявка отдаёт понятную ошибку, а не падает", async () => {
    const { client } = makeClient();
    await assert.rejects(
      () => client.receive("mock-app-99999"),
      (error: unknown) => {
        assert.ok(error instanceof MercuryError);
        assert.equal(error.kind, "app_rejected");
        return true;
      },
    );
  });
});
