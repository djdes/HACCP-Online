import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { aclActorFromSession, canWriteJournal } from "@/lib/journal-acl";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/mini/journals/[code]/bulk-copy-yesterday
 *
 * Copies yesterday's entries into today for the current user.
 * Useful for repetitive daily journals (hygiene, temperature checks, etc.)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const actor = aclActorFromSession({
    user: {
      id: session.user.id,
      role: session.user.role,
      isRoot: session.user.isRoot === true,
    },
  });
  const writable = await canWriteJournal(actor, code);
  if (!writable) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const template = await db.journalTemplate.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
  }

  const orgId = getActiveOrgId(session);
  const userId = session.user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);

  // Check if user already has entries today
  const todayCount = await db.journalEntry.count({
    where: {
      templateId: template.id,
      organizationId: orgId,
      filledById: userId,
      createdAt: { gte: today },
    },
  });

  if (todayCount > 0) {
    return NextResponse.json(
      { error: "Уже есть записи за сегодня. Удалите их перед копированием." },
      { status: 409 }
    );
  }

  // Find yesterday's entries
  const yesterdayEntries = await db.journalEntry.findMany({
    where: {
      templateId: template.id,
      organizationId: orgId,
      filledById: userId,
      createdAt: { gte: yesterday, lte: yesterdayEnd },
    },
    select: { data: true, areaId: true, equipmentId: true },
  });

  if (yesterdayEntries.length === 0) {
    return NextResponse.json(
      { error: "Нет записей за вчера" },
      { status: 404 }
    );
  }

  // Create copies for today
  const created = await db.$transaction(
    yesterdayEntries.map((entry) =>
      db.journalEntry.create({
        data: {
          templateId: template.id,
          organizationId: orgId,
          filledById: userId,
          areaId: entry.areaId,
          equipmentId: entry.equipmentId,
          data: entry.data as never,
          status: "submitted",
        },
      })
    )
  );

  await logAudit({
    organizationId: orgId,
    userId,
    userName: session.user.name ?? undefined,
    action: "journal_entry.copy",
    entity: "journal_entry",
    details: { templateCode: code, count: created.length },
  });

  return NextResponse.json({ copied: created.length });
}
