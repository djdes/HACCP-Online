/**
 * Транспорт поверх мока: принимает тот же XML, что ушёл бы в Ветис, и
 * возвращает тот же XML, что пришёл бы оттуда.
 *
 * Разбор запроса нарочно грубый (по имени операции и нескольким полям) —
 * задача мока не валидировать нашу схему, а прогнать полный цикл
 * submit → poll → parse через боевой код.
 */
import { XMLParser } from "fast-xml-parser";

import {
  mockReceiveResponseXml,
  mockSubmitResponseXml,
} from "./mock/serialize";
import { getMockStore, MockMercuryStore } from "./mock/store";
import { MERCURY_OPERATIONS } from "./ns";
import type { MercuryTransport } from "./transport";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
});

function findNode(node: unknown, name: string): unknown {
  if (node === null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findNode(item, name);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = node as Record<string, unknown>;
  if (name in record) return record[name];
  for (const value of Object.values(record)) {
    const found = findNode(value, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in (value as never)) {
    return String((value as Record<string, unknown>)["#text"]);
  }
  return undefined;
}

export class MockTransport implements MercuryTransport {
  readonly describe = "mock (данные не из Меркурия)";

  constructor(private readonly store: MockMercuryStore = getMockStore()) {}

  async submit(xml: string): Promise<string> {
    const parsed = parser.parse(xml) as Record<string, unknown>;

    // Определяем операцию по присутствию её узла в теле заявки.
    const operation =
      Object.values(MERCURY_OPERATIONS).find(
        (op) => findNode(parsed, op) !== undefined,
      ) ?? "unknown";

    const node = findNode(parsed, operation);
    const enterpriseGuid = asText(findNode(node, "enterpriseGuid"));
    const vetDocumentUuid = asText(findNode(node, "vetDocumentUuid"));
    const uuid = asText(findNode(node, "uuid"));

    // Первое обращение к площадке сразу наполняет её ВСД: демо должно
    // выглядеть работающим, а не пустым.
    if (
      enterpriseGuid &&
      operation !== MERCURY_OPERATIONS.processIncomingConsignment &&
      this.store.listIncoming(enterpriseGuid).length === 0
    ) {
      this.store.seedIncoming(enterpriseGuid);
    }

    const app = this.store.submit(operation, {
      enterpriseGuid,
      vetDocumentUuid: vetDocumentUuid ?? uuid,
    });
    return mockSubmitResponseXml(app);
  }

  async receive(xml: string): Promise<string> {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const applicationId = asText(findNode(parsed, "applicationId")) ?? "";
    const app = this.store.receive(applicationId);
    if (!app) {
      // Тот же смысл, что у настоящего шлюза: заявки старше трёх суток
      // удаляются, и результат по ним не получить.
      return mockReceiveResponseXml(
        {
          id: applicationId,
          operation: "unknown",
          payload: {},
          status: "REJECTED",
          polls: 1,
          errors: [{ code: "APLM10001", message: "Заявка не найдена" }],
          createdAt: Date.now(),
        },
        [],
      );
    }

    const enterpriseGuid = String(app.payload.enterpriseGuid ?? "");
    const documents =
      app.status === "COMPLETED" && !app.resultXml && enterpriseGuid
        ? this.store.listIncoming(enterpriseGuid)
        : [];
    return mockReceiveResponseXml(app, documents);
  }
}
