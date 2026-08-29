import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateAgent } from "@/lib/print-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Сколько символов ошибки принтера показываем — остальное шум драйвера. */
const ERROR_LIMIT = 255;

/**
 * POST /api/print/jobs/<id>/fail — печать не удалась.
 *
 * Агент шлёт это, только когда проблема на его стороне и повтор не
 * поможет (нет бумаги, принтер не найден). Сетевые обрывы он не
 * репортит — их разбирает возврат зависших заданий в очередь при опросе.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  const { id } = await params;
  let message = "Ошибка печати";
  try {
    const body = await request.json();
    message = String(body?.error ?? message).slice(0, ERROR_LIMIT);
  } catch {
    /* тело необязательно — статус важнее текста */
  }

  await db.printJob.updateMany({
    where: { id, agentId: agent.id, status: "printing" },
    data: { status: "error", errorMsg: message },
  });

  return NextResponse.json({ ok: true });
}
