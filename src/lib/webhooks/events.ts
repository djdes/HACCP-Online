/**
 * Список событий исходящих вебхуков и их подписи.
 * Без импортов Node — модуль используется и в клиентских компонентах.
 */
export const WEBHOOK_EVENTS = ["journal.entry", "journal.deviation", "capa.created", "payment.paid", "idea.status", "ping"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_LABEL: Record<WebhookEvent, string> = {
  "journal.entry": "Запись в журнале",
  "journal.deviation": "Отклонение температуры",
  "capa.created": "Создана задача CAPA",
  "payment.paid": "Оплата подписки",
  "idea.status": "Статус идеи изменён",
  ping: "Тестовое событие",
};

export function isWebhookEvent(value: unknown): value is WebhookEvent {
  return typeof value === "string" && (WEBHOOK_EVENTS as readonly string[]).includes(value);
}
