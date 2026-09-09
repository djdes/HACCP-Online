import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import {
  formatSseComment,
  formatSseEvent,
  subscribe,
} from "@/lib/live-events";
import { getServerSession } from "@/lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/live — поток живых событий (Server-Sent Events).
 *
 * Вкладка открывает его один раз и держит. Сервер пишет сюда «что-то
 * изменилось» — уведомление, баланс, — а клиент перечитывает состояние
 * обычным API. Данных в событиях нет намеренно: см. `live-events.ts`.
 *
 * Пульс раз в 25 секунд: nginx по умолчанию рвёт простаивающее
 * проксируемое соединение через 60, и без пульса браузер
 * переподключался бы каждую минуту. Пульс — комментарий SSE, до
 * обработчиков он не доходит.
 *
 * `X-Accel-Buffering: no` — nginx честно уважает этот заголовок и не
 * копит ответ в буфере. Без него события лежали бы в буфере nginx до
 * заполнения, то есть «живые» события приходили бы пачкой через минуту.
 * Править конфиг nginx у приложения прав нет, а заголовок — есть.
 */
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const organizationId = getActiveOrgId(session);
  const encoder = new TextEncoder();

  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (frame: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(frame));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      const unsubscribe = subscribe({ userId, organizationId, send });

      const heartbeat = setInterval(() => {
        if (!send(formatSseComment("ping"))) cleanup();
      }, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* уже закрыт клиентом */
        }
      };

      // Клиент ушёл (закрыл вкладку, перешёл по полной ссылке) —
      // освобождаем слот сразу, не дожидаясь неудачного пульса.
      request.signal.addEventListener("abort", cleanup);

      // Пауза перед переподключением: 3 с — не молотить сервер после
      // перезапуска, но и не заставлять ждать.
      send("retry: 3000\n\n");
      send(formatSseComment("connected"));
      // Первое событие — «перечитай»: браузер только что открыл (или
      // переоткрыл после деплоя) соединение, и всё, что было между,
      // могло потеряться.
      send(formatSseEvent({ type: "reconnect", at: new Date().toISOString() }));
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
