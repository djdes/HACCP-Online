import { NextResponse } from "next/server";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isManagementRole } from "@/lib/user-roles";

/**
 * DELETE /api/staff/[id]
 *
 * Hard-deletes the employee when safe, 409 otherwise so the UI can surface
 * the "delete blocked — please archive" modal. "Safe" means the employee is
 * not referenced by any journal evidence:
 *
 *  - JournalEntry.filledById — the old structured-journal world. FK is
 *    restrict-by-default, so Prisma would throw here anyway; we pre-check to
 *    give a better error message.
 *  - JournalDocumentEntry.employeeId — the newer document-based world.
 *    Column is a plain String without FK, so the DB wouldn't stop us, but
 *    hard-deleting would orphan the audit trail. Block the delete instead.
 *
 * Cascades in the schema handle the clean-up: UserJournalAccess, InviteToken,
 * StaffWorkOffDay, StaffVacation, StaffSickLeave, StaffDismissal all
 * cascade-delete on `User`. FeedbackReport / TelegramLog have nullable userId
 * and happily null out.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (!isManagementRole(session.user.role) && !session.user.isRoot) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { id } = await params;
  const orgId = getActiveOrgId(session);

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Нельзя удалить свою собственную учётную запись" },
      { status: 400 }
    );
  }

  const user = await db.user.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, isRoot: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }
  if (user.isRoot) {
    return NextResponse.json(
      { error: "ROOT-учётную запись удалить нельзя" },
      { status: 400 }
    );
  }

  const [journalEntries, documentEntries] = await Promise.all([
    db.journalEntry.count({ where: { filledById: user.id } }),
    db.journalDocumentEntry.count({ where: { employeeId: user.id } }),
  ]);
  const total = journalEntries + documentEntries;

  if (total > 0) {
    return NextResponse.json(
      {
        error:
          "Данный сотрудник участвует в журналах. Удаление не возможно. Если сотрудник уволился, то перенесите его в архив.",
        blocked: true,
        references: total,
      },
      { status: 409 }
    );
  }

  await db.user.delete({ where: { id: user.id } });
  return NextResponse.json({ ok: true });
}
