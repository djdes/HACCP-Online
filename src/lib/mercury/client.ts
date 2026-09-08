/**
 * Клиент Ветис.API.
 *
 * Форма скопирована с `src/lib/tasksflow-client.ts`: класс без
 * состояния, экземпляр на запрос, фабрика из строки интеграции.
 * Отличие одно, но принципиальное — протокол двухфазный, поэтому клиент
 * НЕ ждёт результат внутри вызова: `submit*` возвращает id заявки, а
 * забирает его отдельный `receive`. Ждать внутри HTTP-хендлера нельзя —
 * заявка думает секунды, а то и десятки.
 *
 * Разделение ключей (см. docs/MERCURY.md):
 *   • APIKey — один на всю платформу, из env;
 *   • issuerGuid и логин уполномоченного лица — свои у организации.
 */
import { decryptSecret } from "@/lib/integration-crypto";

import { MercuryError } from "./errors";
import { HttpSoapTransport } from "./http-transport";
import { MockTransport } from "./mock-transport";
import type { MercuryOperation } from "./ns";
import { resolveTransportMode, type MercuryTransport, type TransportMode } from "./transport";
import type {
  ApplicationResult,
  MercuryEnterpriseInfo,
  MercuryEnvironment,
  ProcessIncomingInput,
  SubmittedApplication,
  VetDocument,
  VetDocumentPage,
} from "./types";
import {
  buildGetActivityLocationList,
  buildGetVetDocumentByUuid,
  buildGetVetDocumentChangesList,
  buildGetVetDocumentList,
  buildProcessIncomingConsignment,
} from "./xml/build-requests";
import {
  buildReceiveApplicationResult,
  buildSubmitApplication,
} from "./xml/envelope";
import {
  parseActivityLocationList,
  parseProcessIncomingResult,
  parseReceiveApplicationResponse,
  parseSubmitApplicationResponse,
  parseVetDocument,
  parseVetDocumentList,
} from "./xml/parse";

export type MercuryClientOptions = {
  apiKey: string;
  issuerGuid: string;
  environment: MercuryEnvironment;
  transport?: MercuryTransport;
  mode?: TransportMode;
};

export class MercuryClient {
  readonly mode: TransportMode;
  private readonly transport: MercuryTransport;

  constructor(private readonly options: MercuryClientOptions) {
    this.mode =
      options.mode ??
      resolveTransportMode({ apiKey: options.apiKey });
    this.transport =
      options.transport ??
      (this.mode === "mock"
        ? new MockTransport()
        : new HttpSoapTransport({
            environment: options.environment,
            login: process.env.MERCURY_SERVICE_LOGIN,
            password: process.env.MERCURY_SERVICE_PASSWORD,
          }));
  }

  get describe(): string {
    return this.transport.describe;
  }

  /** Общий шаг 1: отправить заявку, получить её id. */
  private async submit(applicationDataXml: string): Promise<SubmittedApplication> {
    const xml = buildSubmitApplication({
      apiKey: this.options.apiKey,
      issuerId: this.options.issuerGuid,
      applicationDataXml,
    });
    const response = await this.transport.submit(xml);
    return parseSubmitApplicationResponse(response);
  }

  /**
   * Общий шаг 2: забрать результат.
   *
   * Возвращает и статус, и СЫРОЙ ответ: конкретный разбор зависит от
   * операции, а гонять XML дважды не хочется.
   */
  async receive(applicationId: string): Promise<ApplicationResult & { xml: string }> {
    const xml = buildReceiveApplicationResult({
      apiKey: this.options.apiKey,
      issuerId: this.options.issuerGuid,
      applicationId,
    });
    const response = await this.transport.receive(xml);
    const result = parseReceiveApplicationResponse(response);
    if (result.status === "REJECTED") {
      throw new MercuryError(
        "app_rejected",
        result.errors.map((e) => e.message).join("; ") || "Заявка отклонена",
        { appErrorCodes: result.errors.map((e) => e.code ?? "").filter(Boolean) },
      );
    }
    return { ...result, xml: response };
  }

  // ── Операции: каждая только ОТПРАВЛЯЕТ заявку ──────────────────────

  submitGetVetDocumentList(input: {
    enterpriseGuid: string;
    count?: number;
    offset?: number;
    status?: string;
  }) {
    return this.submit(buildGetVetDocumentList(input));
  }

  submitGetVetDocumentChangesList(input: {
    enterpriseGuid: string;
    beginDate: Date | string;
    endDate: Date | string;
    count?: number;
    offset?: number;
  }) {
    return this.submit(buildGetVetDocumentChangesList(input));
  }

  submitGetVetDocumentByUuid(input: { uuid: string }) {
    return this.submit(buildGetVetDocumentByUuid(input));
  }

  submitGetActivityLocationList(input: { enterpriseGuid: string }) {
    return this.submit(buildGetActivityLocationList(input));
  }

  submitProcessIncomingConsignment(input: ProcessIncomingInput) {
    return this.submit(buildProcessIncomingConsignment(input));
  }

  // ── Разбор результата по типу операции ────────────────────────────

  /**
   * Разбор результата по КЛЮЧУ операции — тому самому, что лежит в
   * `MercuryOutbox.action` (`getVetDocumentList`, а не
   * `GetVetDocumentListRequest`). Имена из `MERCURY_OPERATIONS` — это
   * имена XML-элементов, они живут только внутри сборки запроса.
   */
  static parseResult(action: MercuryOperation | string, xml: string):
    | { kind: "vetDocumentList"; page: VetDocumentPage }
    | { kind: "vetDocument"; document: VetDocument | null }
    | { kind: "processIncoming"; stockEntryGuid: string | null }
    | { kind: "enterprises"; items: MercuryEnterpriseInfo[] }
    | { kind: "unknown" } {
    switch (action) {
      case "getVetDocumentList":
      case "getVetDocumentChangesList":
        return { kind: "vetDocumentList", page: parseVetDocumentList(xml) };
      case "getVetDocumentByUuid":
        return { kind: "vetDocument", document: parseVetDocument(xml) };
      case "processIncomingConsignment":
        return {
          kind: "processIncoming",
          stockEntryGuid: parseProcessIncomingResult(xml).stockEntryGuid,
        };
      case "getActivityLocationList":
        return { kind: "enterprises", items: parseActivityLocationList(xml) };
      default:
        return { kind: "unknown" };
    }
  }
}

/** Строка интеграции → клиент. Зеркало `tasksflowClientFor`. */
export function mercuryClientFor(integration: {
  environment: string;
  issuerGuid: string;
  apiKeyEncrypted?: string | null;
}): MercuryClient {
  // APIKey клиента — редкий случай (у крупного клиента своя
  // зарегистрированная ИС). По умолчанию работаем системным ключом.
  const apiKey = integration.apiKeyEncrypted
    ? decryptSecret(integration.apiKeyEncrypted)
    : (process.env.MERCURY_API_KEY ?? "");

  const environment: MercuryEnvironment =
    integration.environment === "prod" ? "prod" : "test";

  const mode = resolveTransportMode({ apiKey });
  if (mode === "live" && !apiKey) {
    throw new MercuryError(
      "config",
      "Не задан MERCURY_API_KEY — интеграция с Меркурием не настроена",
    );
  }

  return new MercuryClient({
    apiKey,
    issuerGuid: integration.issuerGuid,
    environment,
    mode,
  });
}
