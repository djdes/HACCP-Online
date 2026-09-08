/**
 * Разбор ответов Ветис.API.
 *
 * Почему парсер, а не регулярки: ответы глубоко вложенные, с атрибутами
 * и namespace-префиксами, и один и тот же элемент приходит то объектом,
 * то массивом (Ветис не оборачивает единственный элемент списка).
 *
 * Настройки парсера выбраны осознанно:
 *   • `removeNSPrefix` — иначе каждый ключ был бы `merc:vetDocument`;
 *   • `parseTagValue: false` — типы приводим сами, иначе номер партии
 *     «007» стал бы числом 7, а «Молоко 2.5» — сломанной строкой;
 *   • `ignoreAttributes: false` — статусы приходят и атрибутами тоже.
 */
import { XMLParser } from "fast-xml-parser";

import { MercuryError } from "../errors";
import type {
  ApplicationResult,
  ApplicationStatus,
  MercuryApplicationError,
  MercuryEnterpriseInfo,
  SubmittedApplication,
  VetDocument,
  VetDocumentPage,
  VetDocumentStatus,
  VetDocumentType,
} from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

function parseXml(xml: string): Node {
  try {
    return parser.parse(xml) as Node;
  } catch (error) {
    throw new MercuryError("parse", "не удалось разобрать XML", {
      cause: error,
    });
  }
}

/** Первый попавшийся узел с таким именем на любой глубине. */
function findNode(node: unknown, name: string): unknown {
  if (node === null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findNode(item, name);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = node as Node;
  if (name in record) return record[name];
  for (const value of Object.values(record)) {
    const found = findNode(value, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Ветис не оборачивает единственный элемент списка — нормализуем. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Текст узла: он может быть строкой или объектом с `#text`. */
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && "#text" in (value as Node)) {
    return text((value as Node)["#text"]);
  }
  return null;
}

function num(value: unknown): number | null {
  const raw = text(value);
  if (raw === null) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** `2026-09-08` из `<issueDate>` или из вложенных year/month/day. */
function dateKey(value: unknown): string | null {
  const raw = text(value);
  if (raw) return raw.slice(0, 10);
  if (value && typeof value === "object") {
    const node = value as Node;
    const y = text(node.year);
    const m = text(node.month);
    const d = text(node.day);
    if (y && m && d) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Конверт заявки
// ────────────────────────────────────────────────────────────────────

/** SOAP Fault — шлюз не понял запрос. Повторять бессмысленно. */
function throwIfFault(root: Node): void {
  const fault = findNode(root, "Fault");
  if (!fault) return;
  const faultNode = fault as Node;
  const code =
    text(faultNode.faultcode) ?? text(findNode(faultNode, "Value")) ?? undefined;
  const message =
    text(faultNode.faultstring) ??
    text(findNode(faultNode, "Text")) ??
    "SOAP Fault без описания";
  throw new MercuryError("soap_fault", message, { faultCode: code ?? undefined });
}

function normalizeStatus(raw: string | null): ApplicationStatus {
  switch ((raw ?? "").toUpperCase()) {
    case "ACCEPTED":
      return "ACCEPTED";
    case "IN_PROCESS":
    case "IN PROCESS":
      return "IN_PROCESS";
    case "COMPLETED":
      return "COMPLETED";
    case "REJECTED":
      return "REJECTED";
    default:
      return "IN_PROCESS";
  }
}

export function parseSubmitApplicationResponse(
  xml: string,
): SubmittedApplication {
  const root = parseXml(xml);
  throwIfFault(root);
  const application = findNode(root, "application");
  const applicationId = text(findNode(application, "applicationId"));
  if (!applicationId) {
    throw new MercuryError(
      "parse",
      "в ответе нет applicationId — шлюз не принял заявку",
    );
  }
  return {
    applicationId,
    status: normalizeStatus(text(findNode(application, "status"))),
  };
}

function collectErrors(application: unknown): MercuryApplicationError[] {
  const errorsNode = findNode(application, "errors") ?? findNode(application, "error");
  return asArray(errorsNode as unknown[])
    .flatMap((item) => asArray((item as Node)?.error ?? item))
    .map((item) => ({
      code: text((item as Node)?.["@_code"]) ?? text((item as Node)?.code),
      message: text(item) ?? text((item as Node)?.message) ?? "Ошибка Меркурия",
    }))
    .filter((e) => Boolean(e.message));
}

export function parseReceiveApplicationResponse(xml: string): ApplicationResult {
  const root = parseXml(xml);
  throwIfFault(root);
  const application = findNode(root, "application");
  const status = normalizeStatus(text(findNode(application, "status")));
  const applicationId = text(findNode(application, "applicationId")) ?? "";
  return {
    applicationId,
    status,
    // Тело результата разбирают parse-модули ниже: чтобы не гонять XML
    // дважды, отдаём уже разобранный узел под видом «resultXml».
    resultXml: null,
    errors: status === "REJECTED" ? collectErrors(application) : [],
  };
}

/**
 * Разобранное тело результата.
 *
 * `receiveApplicationResultRequest` возвращает и статус, и полезную
 * нагрузку одним документом, поэтому отдельного «resultXml» нет —
 * функции ниже принимают тот же XML целиком.
 */

// ────────────────────────────────────────────────────────────────────
// ВСД
// ────────────────────────────────────────────────────────────────────

function normalizeDocStatus(raw: string | null): VetDocumentStatus {
  const value = (raw ?? "").toUpperCase();
  const known: VetDocumentStatus[] = [
    "CREATED",
    "CONFIRMED",
    "WITHDRAWN",
    "UTILIZED",
    "STORED",
    "OUTGOING",
  ];
  return (known as string[]).includes(value)
    ? (value as VetDocumentStatus)
    : "UNKNOWN";
}

function normalizeDocType(raw: string | null): VetDocumentType {
  const value = (raw ?? "").toUpperCase();
  if (value === "TRANSPORT" || value === "PRODUCTIVE" || value === "RETURNABLE") {
    return value;
  }
  return "UNKNOWN";
}

/** Один `<vetDocument>` → доменный тип. */
export function parseVetDocumentNode(node: unknown): VetDocument | null {
  const uuid = text(findNode(node, "uuid"));
  if (!uuid) return null;

  const consignment = findNode(node, "consignment") ?? node;
  const batch = findNode(consignment, "batch") ?? findNode(node, "batch");
  const product = findNode(batch, "productItem") ?? findNode(batch, "product");

  const consignee = findNode(node, "consignee");
  const consignor = findNode(node, "consignor");

  const producer =
    findNode(batch, "origin") ?? findNode(batch, "producer") ?? undefined;

  const accompanying = asArray(
    (findNode(node, "referencedDocument") ?? []) as unknown[],
  )
    .map((doc) => {
      const type = text(findNode(doc, "type"));
      const number = text(findNode(doc, "number"));
      const issue = dateKey(findNode(doc, "issueDate"));
      return [type, number, issue].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("; ");

  return {
    uuid,
    number: text(findNode(node, "number")),
    docType: normalizeDocType(text(findNode(node, "vetDType")) ?? text(findNode(node, "type"))),
    status: normalizeDocStatus(text(findNode(node, "status"))),
    issueDate: dateKey(findNode(node, "issueDate")),
    deliveryDate:
      dateKey(findNode(node, "deliveryDate")) ??
      dateKey(findNode(consignment, "deliveryDate")),
    consigneeEnterpriseGuid:
      text(findNode(consignee, "guid")) ?? text(findNode(consignee, "enterpriseGuid")),
    consignorEnterpriseGuid:
      text(findNode(consignor, "guid")) ?? text(findNode(consignor, "enterpriseGuid")),
    consignorName: text(findNode(consignor, "name")),
    consignorInn: text(findNode(consignor, "inn")),
    manufacturerName: text(findNode(producer, "name")),
    productName:
      text(findNode(product, "name")) ?? text(findNode(batch, "productName")),
    productType: text(findNode(batch, "productType")),
    volume: num(findNode(batch, "volume")),
    unit: text(findNode(findNode(batch, "unit"), "name")) ?? text(findNode(batch, "unit")),
    batchNumber: text(findNode(batch, "batchId")) ?? text(findNode(batch, "batchNumber")),
    productionDate:
      dateKey(findNode(findNode(batch, "dateOfProduction"), "firstDate")) ??
      dateKey(findNode(batch, "dateOfProduction")),
    expiryDate:
      dateKey(findNode(findNode(batch, "expiryDate"), "firstDate")) ??
      dateKey(findNode(batch, "expiryDate")),
    transportInfo:
      text(findNode(findNode(node, "transportInfo"), "transportNumber")) ??
      text(findNode(node, "transportNumber")),
    accompanyingDocs: accompanying || null,
    raw: node,
  };
}

/** Ответ `GetVetDocumentListRequest` / `...ChangesListRequest`. */
export function parseVetDocumentList(xml: string): VetDocumentPage {
  const root = parseXml(xml);
  throwIfFault(root);
  const listNode = findNode(root, "vetDocumentList");
  const documents = asArray(
    (findNode(listNode, "vetDocument") ?? []) as unknown[],
  )
    .map(parseVetDocumentNode)
    .filter((d): d is VetDocument => d !== null);

  return {
    documents,
    total: num(findNode(listNode, "total")) ?? documents.length,
    offset: num(findNode(listNode, "offset")) ?? 0,
    count: num(findNode(listNode, "count")) ?? documents.length,
  };
}

/** Ответ `GetVetDocumentByUuidRequest`. */
export function parseVetDocument(xml: string): VetDocument | null {
  const root = parseXml(xml);
  throwIfFault(root);
  const node = findNode(root, "vetDocument");
  return node ? parseVetDocumentNode(node) : null;
}

/** Ответ `ProcessIncomingConsignmentRequest`. */
export function parseProcessIncomingResult(xml: string): {
  stockEntryGuid: string | null;
} {
  const root = parseXml(xml);
  throwIfFault(root);
  const stockEntry = findNode(root, "stockEntry");
  return {
    stockEntryGuid:
      text(findNode(stockEntry, "guid")) ?? text(findNode(root, "stockEntryGuid")),
  };
}

/** Ответ `GetActivityLocationListRequest`. */
export function parseActivityLocationList(
  xml: string,
): MercuryEnterpriseInfo[] {
  const root = parseXml(xml);
  throwIfFault(root);
  const listNode =
    findNode(root, "activityLocationList") ?? findNode(root, "enterpriseList");
  return asArray(
    (findNode(listNode, "activityLocation") ?? findNode(listNode, "enterprise") ?? []) as unknown[],
  )
    .map((node): MercuryEnterpriseInfo | null => {
      const enterprise = findNode(node, "enterprise") ?? node;
      const guid = text(findNode(enterprise, "guid"));
      if (!guid) return null;
      return {
        enterpriseGuid: guid,
        activityLocationGuid: text(findNode(node, "guid")),
        name: text(findNode(enterprise, "name")) ?? "Без названия",
        address: text(findNode(findNode(enterprise, "address"), "addressView")),
      };
    })
    .filter((e): e is MercuryEnterpriseInfo => e !== null);
}

export const __testing = { findNode, asArray, text, num, dateKey };
