import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateAgent } from "@/lib/print-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/print/jobs/<id>/complete — агент отчитался, что напечатал.
 *
 * Идемпотентно: повторный вызов ничего не меняет и возвращает 200. Агент
 * мог не получить наш ответ из-за обрыва связи и повторить — считать это
 * ошибкой значило бы пугать человека на пустом месте.
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
  await db.printJob.updateMany({
    where: { id, agentId: agent.id, status: "printing" },
    data: { status: "done", printedAt: new Date(), errorMsg: null },
  });

  return NextResponse.json({ ok: true });
}
