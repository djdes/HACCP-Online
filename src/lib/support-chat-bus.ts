/**
 * Шина «открой чат поддержки». Виджет поддержки живёт в layout'е, а
 * открыть его нужно из всплывашки о новом сообщении, из колокольчика и
 * по deep-link'у `?support=chat`. Тот же приём, что в sanpin-chat-bus.
 */
export const SUPPORT_CHAT_OPEN_EVENT = "wesetup:support-chat-open";
/** Клиент прочитал чат — уведомитель может погасить бейдж без ожидания poll'а. */
export const SUPPORT_CHAT_READ_EVENT = "wesetup:support-chat-read";

export function openSupportChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SUPPORT_CHAT_OPEN_EVENT));
}

export function announceSupportChatRead(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SUPPORT_CHAT_READ_EVENT));
}
