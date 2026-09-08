/**
 * Типизированная ошибка Меркурия.
 *
 * `kind` существует ради `outbox-policy.ts`: политика повторов должна
 * строиться на типе ошибки, а не на разборе текста сообщения. У
 * TasksFlow это сделано через `status`-коды HTTP, но SOAP-шлюз кладёт
 * бизнес-отказ внутрь успешного HTTP 200, поэтому одного статуса мало.
 */
export type MercuryErrorKind =
  /** Сеть недоступна, таймаут, DNS. Повторяем. */
  | "network"
  /** HTTP не 200 — 5xx повторяем, 4xx нет. */
  | "http"
  /** SOAP Fault: шлюз принял запрос, но не понял. Не повторяем. */
  | "soap_fault"
  /** Заявка отклонена Меркурием по бизнес-причине. Не повторяем. */
  | "app_rejected"
  /** Ответ не разобрался — наш парсер или их схема. Не повторяем. */
  | "parse"
  /** Интеграция настроена неполно (нет APIKey, issuerGuid). Не повторяем. */
  | "config";

export class MercuryError extends Error {
  readonly kind: MercuryErrorKind;
  readonly httpStatus?: number;
  readonly faultCode?: string;
  /** Коды бизнес-ошибок Ветис — по ним ловится «ВСД уже погашен». */
  readonly appErrorCodes: string[];

  constructor(
    kind: MercuryErrorKind,
    message: string,
    options: {
      httpStatus?: number;
      faultCode?: string;
      appErrorCodes?: string[];
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "MercuryError";
    this.kind = kind;
    this.httpStatus = options.httpStatus;
    this.faultCode = options.faultCode;
    this.appErrorCodes = options.appErrorCodes ?? [];
  }

  /** Имеет ли смысл повторять запрос. */
  get retryable(): boolean {
    if (this.kind === "network") return true;
    if (this.kind === "http") return (this.httpStatus ?? 0) >= 500;
    return false;
  }
}

/**
 * Признак «ВСД уже погашен».
 *
 * Ключевая защита от двойного гашения: если Меркурий отвечает, что
 * документ уже обработан, для нас это УСПЕХ, а не ошибка — значит наша
 * предыдущая попытка дошла, просто мы потеряли её результат.
 *
 * Точные коды выясняются на тестовом контуре; пока ловим и по коду, и по
 * тексту, и список расширяется одной строкой.
 */
const ALREADY_PROCESSED_CODES = new Set([
  "APLM10004",
  "MERC10005",
]);

const ALREADY_PROCESSED_PATTERNS = [
  /уже\s+погаш/i,
  /уже\s+обработан/i,
  /already\s+(processed|utilized)/i,
  /состояни[ие]\s+.*UTILIZED/i,
];

export function isAlreadyProcessedError(error: unknown): boolean {
  if (!(error instanceof MercuryError)) return false;
  if (error.appErrorCodes.some((c) => ALREADY_PROCESSED_CODES.has(c))) {
    return true;
  }
  return ALREADY_PROCESSED_PATTERNS.some((re) => re.test(error.message));
}

/** Короткий человеческий текст для UI и поля `lastError`. */
export function describeMercuryError(error: unknown): string {
  if (error instanceof MercuryError) {
    switch (error.kind) {
      case "network":
        return "Меркурий не отвечает — повторим автоматически";
      case "http":
        return `Меркурий вернул HTTP ${error.httpStatus ?? "?"}`;
      case "soap_fault":
        return `Шлюз отклонил запрос: ${error.message}`;
      case "app_rejected":
        return error.message;
      case "parse":
        return `Не удалось разобрать ответ Меркурия: ${error.message}`;
      case "config":
        return error.message;
    }
  }
  return error instanceof Error ? error.message : String(error);
}
