/**
 * Мост между виджетом поддержки и AI-помощником.
 *
 * Оба пузыря висят в углу кабинета соседями внутри `(dashboard)/layout.tsx`
 * и не имеют общего родителя со стейтом. Пункт «ИИ Помощник» в поддержке
 * должен открывать существующий чат, а не заводить второй такой же, —
 * window-событие дешевле, чем контекст ради одного булева флага.
 */

export const SANPIN_CHAT_OPEN_EVENT = "wesetup:sanpin-chat-open";

export function openSanpinChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SANPIN_CHAT_OPEN_EVENT));
}
