/**
 * Потоковое ли тело запроса.
 *
 * Нужно ровно для одного: undici требует `duplex: "half"`, когда тело
 * запроса — поток, и бросает
 * «RequestInit: duplex option is required when sending a body», если его
 * не передать. А для строк и буферов лишний `duplex`, наоборот, лишний.
 *
 * Из-за этого молча не работала отправка вложений в Telegram: сообщения
 * уходили (тело строкой), а фото из обращения падало на конструкторе
 * Request. Человек видел, что обращение отправлено, а снимок до нас не
 * доезжал.
 *
 * Проверка по «утиной типизации», а не `instanceof ReadableStream`:
 * поток может прийти из другой реализации (node:stream/web, undici,
 * полифилл grammy), и все они не пройдут проверку по конкретному классу,
 * хотя ведут себя одинаково.
 */
export function isStreamingBody(body: unknown): boolean {
  if (body == null) return false;

  // Строки, буферы и формы undici сериализует сам — поток им не нужен.
  if (typeof body === "string") return false;
  if (typeof Blob !== "undefined" && body instanceof Blob) return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return false;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return false;
  }
  if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer) return false;

  const candidate = body as {
    getReader?: unknown;
    pipe?: unknown;
    [Symbol.asyncIterator]?: unknown;
  };

  // Web-поток.
  if (typeof candidate.getReader === "function") return true;
  // Поток Node (grammy отдаёт именно такой для InputFile из пути).
  if (typeof candidate.pipe === "function") return true;
  // Асинхронный генератор тоже принимается как тело.
  if (typeof candidate[Symbol.asyncIterator] === "function") return true;

  return false;
}
