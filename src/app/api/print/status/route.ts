import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { isAgentOnline } from "@/lib/print-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Сколько последних заданий показываем в истории печати. */
const HISTORY_LIMIT = 15;

/**
 * GET /api/print/status — состояние принтера и история печати для блока
 * «Онлайн принтер» на дашборде.
 */
export async function GET() {
  const session = await requireAuth();
  const organizationId = getActiveOrgId(session);

  const [agents, jobs] = await Promise.all([
    db.printAgent.findMany({
      where: { organizationId, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        name: true,
        printerName: true,
        lastSeenAt: true,
        agentVersion: true,
      },
    }),
    db.printJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true,
        docTitle: true,
        status: true,
        errorMsg: true,
        createdAt: true,
        printedAt: true,
        createdByName: true,
      },
    }),
  ]);

  return NextResponse.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      printerName: a.printerName,
      agentVersion: a.agentVersion,
      lastSeenAt: a.lastSeenAt?.toISOString() ?? null,
      online: isAgentOnline(a.lastSeenAt),
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      docTitle: j.docTitle,
      status: j.status,
      errorMsg: j.errorMsg,
      createdAt: j.createdAt.toISOString(),
      printedAt: j.printedAt?.toISOString() ?? null,
      createdByName: j.createdByName,
    })),
  });
}
