import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { buildAssistantContext } from "@/lib/assistant/context";
import { findPendingByToken, markFetched } from "@/lib/assistant/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Срез базы знаний для исполнителя.
 *
 * Единственный ключ — одноразовый токен хода. По нему находится диалог, а
 * по диалогу — организация. Никаких `organizationId` в запросе: параметр,
 * который можно подставить снаружи, рано или поздно подставят.
 */

const limiter = createRateLimiter({
  tokensPerInterval: 60,
  intervalMs: 60_000,
});

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function GET(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  if (!limiter.consume(`assistant-cb:${ip}`)) {
    return NextResponse.json({ error: "Слишком часто" }, { status: 429 });
  }

  const token = bearer(request);
  if (!token) {
    return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  }

  const message = await findPendingByToken(token);
  if (!message) {
    return NextResponse.json(
      { error: "Ход не найден или уже закрыт" },
      { status: 404 }
    );
  }

  // Отметка «контекст забрали» отличает «никто не подхватил задание» от
  // «взяли в работу, но долго думают» — без неё в панели не разобрать.
  await markFetched(message.id).catch(() => undefined);

  const context = await buildAssistantContext({
    organizationId: message.conversation.organizationId,
    userId: message.conversation.userId,
    conversationId: message.conversationId,
  });

  return NextResponse.json(context);
}
