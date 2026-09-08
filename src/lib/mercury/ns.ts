/**
 * Namespace'ы, адреса и идентификаторы сервисов Ветис.API.
 *
 * Всё, что может разойтись с реальным шлюзом, собрано в одном файле —
 * на стадии тестового контура калибруются ТОЛЬКО этот модуль, фикстуры и
 * `http-transport.ts`. Так подгонка под настоящий Ветис не расползается
 * по кодовой базе.
 *
 * Версия вынесена в env: в проде живёт 2.1, в пилоте — 3.0, и в 3.0
 * схемы ВСД меняются. Пытаться сразу написать «универсальный» парсер под
 * обе — преждевременная абстракция; когда дойдёт, парсеры форкнутся.
 */
import type { MercuryEnvironment } from "./types";

export const MERCURY_API_VERSION = process.env.MERCURY_API_VERSION || "2.1";

/**
 * Базовые адреса шлюза. В БД не хранятся сознательно: подменив URL, можно
 * увести запросы вместе с APIKey на чужой хост.
 */
export const MERCURY_BASE_URLS: Record<MercuryEnvironment, string> = {
  test: "https://api2.vetrf.ru:8002/platform/services",
  prod: "https://api.vetrf.ru/platform/services",
};

/**
 * Адрес ApplicationManagementService.
 *
 * `MERCURY_BASE_URL` — ПОЛНЫЙ override, а не префикс: он существует ради
 * локального мок-шлюза (`/api/dev/mercury-mock`), у которого нет и не
 * должно быть версионного пути Ветис. Дописывать к нему
 * `/2.1/ApplicationManagementService` значило бы промахиваться мимо
 * роута и отлаживать 404 вместо интеграции.
 */
export function applicationServiceUrl(env: MercuryEnvironment): string {
  const override = process.env.MERCURY_BASE_URL;
  if (override) return override;
  return `${MERCURY_BASE_URLS[env]}/${MERCURY_API_VERSION}/ApplicationManagementService`;
}

/**
 * `serviceId` подсистемы обработки заявок: указывает, какому компоненту
 * ВетИС адресована заявка. Для гашения и чтения ВСД это Меркурий.
 */
export const MERCURY_SERVICE_ID = `mercury-g2b.service:${MERCURY_API_VERSION}`;

/** Префиксы пространств имён, как их ждёт шлюз. */
export const NS = {
  soap: "http://schemas.xmlsoap.org/soap/envelope/",
  /** Подсистема обработки заявок. */
  apldef: "http://api.vetrf.ru/schema/cdm/application/ws-definitions",
  apl: "http://api.vetrf.ru/schema/cdm/application",
  /** Базовые типы (Guid, дата, пагинация). */
  bs: "http://api.vetrf.ru/schema/cdm/base",
  /** Меркурий: заявки g2b. */
  merc: "http://api.vetrf.ru/schema/cdm/mercury/g2b.application",
  /** Ветеринарные документы. */
  vd: "http://api.vetrf.ru/schema/cdm/mercury/vet-document/v2",
  /** Реестр предприятий «Цербер». */
  ent: "http://api.vetrf.ru/schema/cdm/registry/enterprise",
  /** Общие типы Меркурия. */
  dt: "http://api.vetrf.ru/schema/cdm/dictionary/v2",
} as const;

/** Имена операций Меркурия внутри заявки. */
export const MERCURY_OPERATIONS = {
  getVetDocumentList: "GetVetDocumentListRequest",
  getVetDocumentChangesList: "GetVetDocumentChangesListRequest",
  getVetDocumentByUuid: "GetVetDocumentByUuidRequest",
  processIncomingConsignment: "ProcessIncomingConsignmentRequest",
  getActivityLocationList: "GetActivityLocationListRequest",
} as const;

export type MercuryOperation = keyof typeof MERCURY_OPERATIONS;

/**
 * Команды меняют состояние в Меркурии; остальное — чтение.
 *
 * Различие несёт смысл в очереди: health-алерт срабатывает только на
 * застрявших командах, а повторная отправка команды требует проверки,
 * не выполнилась ли она уже (см. `outbox-policy.ts`).
 */
export const MERCURY_COMMAND_OPERATIONS: ReadonlySet<MercuryOperation> =
  new Set<MercuryOperation>(["processIncomingConsignment"]);

export function isCommandOperation(operation: string): boolean {
  return MERCURY_COMMAND_OPERATIONS.has(operation as MercuryOperation);
}

/** Сколько Ветис хранит результат заявки — после этого он потерян навсегда. */
export const APPLICATION_RESULT_TTL_DAYS = 3;
