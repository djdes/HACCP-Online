import { NextResponse } from "next/server";
import { authenticateAgent, touchAgent } from "@/lib/print-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/print/agent/state — агент сообщает, какой принтер выбран и
 * какие вообще есть на машине.
 *
 * Шлётся при старте и при смене принтера в настройках программы. Нужно,
 * чтобы в дашборде было видно не просто «онлайн», а «онлайн, печатает на
 * HP LaserJet» — иначе при проверке непонятно, куда уедет бланк.
 */
export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  let body: { printerName?: unknown; printers?: unknown; agentVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const printers = Array.isArray(body.printers)
    ? body.printers.map((p) => String(p).slice(0, 200)).slice(0, 50)
    : undefined;

  await touchAgent(agent.id, null, {
    printerName:
      body.printerName === undefined
        ? undefined
        : String(body.printerName ?? "").slice(0, 200) || null,
    ...(printers ? { printers } : {}),
    ...(body.agentVersion
      ? { agentVersion: String(body.agentVersion).slice(0, 40) }
      : {}),
  });

  return NextResponse.json({ ok: true });
}
