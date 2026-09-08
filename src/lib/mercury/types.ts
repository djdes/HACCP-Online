/**
 * Доменные типы Меркурия. Ноль XML, ноль сети — их видит и UI, и тесты.
 *
 * Сознательно НЕ повторяют схему Ветис один в один: из ВСД берётся то,
 * что нужно журналу приёмки и списку «Входящие ВСД», а полный документ
 * едет рядом в `raw`, чтобы при смене маппинга не ходить в Меркурий
 * заново.
 */

/** Статус ВСД в Ветис. */
export type VetDocumentStatus =
  | "CREATED"
  | "CONFIRMED"
  | "WITHDRAWN"
  | "UTILIZED"
  | "STORED"
  | "OUTGOING"
  | "UNKNOWN";

/** Тип ВСД. */
export type VetDocumentType = "TRANSPORT" | "PRODUCTIVE" | "RETURNABLE" | "UNKNOWN";

/** Наш статус обработки — то, что видит менеджер. */
export type LocalVetDocumentStatus =
  | "new"
  | "acknowledged"
  | "processing"
  | "processed"
  | "process_failed"
  /** Исходящий или чужой — держим, чтобы не перечитывать каждый тик. */
  | "irrelevant";

/** Решение по приёмке партии. */
export type ConsignmentDecision = "ACCEPT" | "PARTIALLY" | "RETURN" | "REJECT";

/** Режим гашения, `MercuryIntegration.autoProcessMode`. */
export type AutoProcessMode = "off" | "assisted" | "auto_after_journal";

export type MercuryEnvironment = "test" | "prod";

/** Площадка/предприятие в реестре «Цербер». */
export type MercuryEnterpriseInfo = {
  enterpriseGuid: string;
  activityLocationGuid?: string | null;
  name: string;
  address?: string | null;
};

/** Разобранный ВСД в том виде, в каком он нужен приложению. */
export type VetDocument = {
  uuid: string;
  number?: string | null;
  docType: VetDocumentType;
  status: VetDocumentStatus;
  issueDate?: string | null;
  /** `YYYY-MM-DD` — дата поставки, от неё считается дедлайн гашения. */
  deliveryDate?: string | null;
  /** ГУИД площадки-получателя: по нему решаем, входящий ли это ВСД. */
  consigneeEnterpriseGuid?: string | null;
  consignorEnterpriseGuid?: string | null;
  consignorName?: string | null;
  consignorInn?: string | null;
  manufacturerName?: string | null;
  productName?: string | null;
  productType?: string | null;
  volume?: number | null;
  unit?: string | null;
  batchNumber?: string | null;
  productionDate?: string | null;
  expiryDate?: string | null;
  transportInfo?: string | null;
  /** «ТТН №…», номера сопроводительных документов из ВСД. */
  accompanyingDocs?: string | null;
  /** Полный распарсенный документ — источник правды при доработке маппинга. */
  raw: unknown;
};

/** Фактические данные приёмки, которые вводит человек перед гашением. */
export type ProcessIncomingInput = {
  vetDocumentUuid: string;
  enterpriseGuid: string;
  /** Логин уполномоченного лица клиента в Меркурии. */
  initiatorLogin: string;
  decision: ConsignmentDecision;
  /** Фактический объём. null — принято ровно как в ВСД. */
  actualVolume?: number | null;
  unit?: string | null;
  /** Три булевых из бланка входного контроля. */
  transportConditionOk: boolean;
  packagingOk: boolean;
  documentsOk: boolean;
  /** Температура продукта при приёмке, как в журнале. */
  productTemperature?: string | null;
  /** Причина при decision ≠ ACCEPT. Обязательна — иначе Ветис откажет. */
  discrepancyReason?: string | null;
};

export type ProcessIncomingResult = {
  /** ГУИД записи складского журнала, созданной гашением. */
  stockEntryGuid?: string | null;
};

/** Статус заявки в подсистеме обработки Ветис.API. */
export type ApplicationStatus =
  | "ACCEPTED"
  | "IN_PROCESS"
  | "COMPLETED"
  | "REJECTED";

/** Ответ `submitApplicationRequest`. */
export type SubmittedApplication = {
  applicationId: string;
  status: ApplicationStatus;
};

/** Ответ `receiveApplicationResultRequest`. */
export type ApplicationResult = {
  applicationId: string;
  status: ApplicationStatus;
  /** Тело `<application><result>` — его разбирают parse-*-модули. */
  resultXml?: string | null;
  errors: MercuryApplicationError[];
};

export type MercuryApplicationError = {
  code?: string | null;
  message: string;
};

/** Страница списка ВСД. */
export type VetDocumentPage = {
  documents: VetDocument[];
  total: number;
  offset: number;
  count: number;
};
