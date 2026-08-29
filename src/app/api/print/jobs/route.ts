import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { aclActorFromSession, hasJournalAccess } from "@/lib/journal-acl";
import { AGENT_ONLINE_WINDOW_MS } from "@/lib/print-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/print/jobs — отправить журнал на принтер заведения.
 *
 * Ради этого всё и делалось: пришла проверка, человек с телефона открыл
 * журнал и нажал «На принтер» — бланк выехал на кассе, никого не надо
 * звать к компьютеру.
 *
 * Права проверяем здесь и только здесь: у агента своих прав на журналы
 * нет, он печатает то, что ему дали.
 */
export async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = getActiveOrgId(session);

  let body: { documentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const documentId = String(body.documentId ?? "").trim();
  if (!documentId) {
    return NextResponse.json({ error: "Не указан документ" }, { status: 400 });
  }

  const doc = await db.journalDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      organizationId: true,
      template: { select: { code: true, name: true } },
    },
  });
  if (!doc || doc.organizationId !== organizationId) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  // Та же проверка, что у скачивания PDF: если человеку нельзя скачать
  // журнал, то и распечатать его он не должен.
  const access = await hasJournalAccess(
    aclActorFromSession({
      user: {
        id: session.user.id,
        role: session.user.role,
        isRoot: session.user.isRoot === true,
      },
    }),
    doc.template.code,
  );
  if (!access) {
    return NextResponse.json(
      { error: "Нет доступа к этому журналу" },
      { status: 403 },
    );
  }

  const online = await db.printAgent.findFirst({
    where: {
      organizationId,
      revokedAt: null,
      lastSeenAt: { gte: new Date(Date.now() - AGENT_ONLINE_WINDOW_MS) },
    },
    select: { id: true, name: true },
  });

  // Задание ставим в очередь даже без агента на связи: он может
  // подняться через минуту и допечатает. Но человеку об этом говорим
  // сразу — иначе он будет стоять у принтера и не понимать, чего ждёт.
  const job = await db.printJob.create({
    data: {
      organizationId,
      documentId: doc.id,
      docTitle: `${doc.template.name} — ${doc.title}`,
      createdById: session.user.id,
      createdByName: session.user.name ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({
    jobId: job.id,
    agentOnline: Boolean(online),
    agentName: online?.name ?? null,
  });
}
