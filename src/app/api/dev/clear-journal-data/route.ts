import { NextResponse } from "next/server";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isSuperUser } from "@/lib/super-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dev/clear-journal-data
 *
 * SUPER-USER ONLY (см. src/lib/super-user.ts). Сносит ВСЕ журнальные
 * записи в текущей организации:
 *   - JournalEntry (field-based)
 *   - JournalDocument + JournalDocumentEntry (document-based)
 *   - JournalEntryAttachment (через cascade DB)
 *   - TasksFlowTaskLink (чтобы task'и можно было создать заново)
 *
 * НЕ ТРОГАЕТ: users, positions, organization settings, journal templates,
 * job-position-journal-access, journalResponsibleUsersJson, areas,
 * equipment, buildings, rooms — структура и иерархия остаются.
 *
 * Идемпотентно — повторный вызов вернёт нули. Безопасно scoped по
 * organizationId — даже если super-user, чужие orgs не затрагиваются.
 *
 * Returns: { entriesDeleted, documentsDeleted, documentEntriesDeleted,
 *            tasksflowLinksDeleted }
 */
export async function POST() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  if (!isSuperUser(session)) {
    return NextResponse.json(
      { error: "Эта функция доступна только специальному admin-аккаунту." },
      { status: 403 },
    );
  }

  const organizationId = getActiveOrgId(session);

  // 1. Document-based journals: сначала entries (FK), потом documents.
  const documentIds = await db.journalDocument.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const docIdList = documentIds.map((d) => d.id);

  const documentEntriesResult = docIdList.length
    ? await db.journalDocumentEntry.deleteMany({
        where: { documentId: { in: docIdList } },
      })
    : { count: 0 };

  const documentsResult = await db.journalDocument.deleteMany({
    where: { organizationId },
  });

  // 2. Field-based journals.
  const entriesResult = await db.journalEntry.deleteMany({
    where: { organizationId },
  });

  // 3. TasksFlow links для этой орги — чтобы bulk-assign мог создавать
  //    task'и заново (без него «уже создано» блокирует повтор).
  // TasksFlowTaskLink → integration → organization, прямого FK на orgId
  // нет, поэтому фильтруем через integration.
  const tfLinksResult = await db.tasksFlowTaskLink.deleteMany({
    where: { integration: { organizationId } },
  });

  return NextResponse.json({
    ok: true,
    entriesDeleted: entriesResult.count,
    documentsDeleted: documentsResult.count,
    documentEntriesDeleted: documentEntriesResult.count,
    tasksflowLinksDeleted: tfLinksResult.count,
  });
}
