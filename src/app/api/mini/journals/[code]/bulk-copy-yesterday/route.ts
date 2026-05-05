import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { aclActorFromSession, canWriteJournal } from "@/lib/journal-acl";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { isDocumentTemplate } from "@/lib/journal-document-helpers";

export const dynamic = "force-dynamic";

class BulkCopyError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

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

  // Document-based journals (hygiene, cleaning, cold_equipment, климат и
  // т.д.) живут в JournalDocument/JournalDocumentEntry — у них нет
  // концепции «вчерашних JournalEntry-строк». Раньше bulk-copy создавал
  // phantom-rows в JournalEntry: документ-grid их никогда не показывал,
  // но obligation-status-syncer считал journal заполненным → ложное
  // «done» по compliance-критерию. Это falsified compliance status,
  // что для HACCP-системы недопустимо.
  if (isDocumentTemplate(code)) {
    return NextResponse.json(
      {
        error:
          "Этот журнал заполняется таблицей за период. Откройте сегодняшнюю таблицу — там есть «копировать вчерашний день».",
      },
      { status: 400 }
    );
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

  // Check + read + insert в одной Serializable-транзакции — раньше
  // count был отдельным query, и двойной тап мог пройти оба count==0
  // check'а параллельно перед первым create → 2× дубликаты строк.
  // Pass-3 HIGH #3.
  let yesterdayEntriesLen = 0;
  let created: { id: string }[];
  try {
    const result = await db.$transaction(
      async (tx) => {
        const todayCount = await tx.journalEntry.count({
          where: {
            templateId: template.id,
            organizationId: orgId,
            filledById: userId,
            createdAt: { gte: today },
          },
        });
        if (todayCount > 0) {
          throw new BulkCopyError(
            409,
            "Уже есть записи за сегодня. Удалите их перед копированием."
          );
        }
        const yesterdayEntries = await tx.journalEntry.findMany({
          where: {
            templateId: template.id,
            organizationId: orgId,
            filledById: userId,
            createdAt: { gte: yesterday, lte: yesterdayEnd },
          },
          select: { data: true, areaId: true, equipmentId: true },
        });
        if (yesterdayEntries.length === 0) {
          throw new BulkCopyError(404, "Нет записей за вчера");
        }
        yesterdayEntriesLen = yesterdayEntries.length;
        const inserted = await Promise.all(
          yesterdayEntries.map((entry) =>
            tx.journalEntry.create({
              data: {
                templateId: template.id,
                organizationId: orgId,
                filledById: userId,
                areaId: entry.areaId,
                equipmentId: entry.equipmentId,
                data: entry.data as never,
                status: "submitted",
              },
              select: { id: true },
            })
          )
        );
        return inserted;
      },
      // Serializable защищает от non-repeatable-read: даже если второй
      // запрос параллельно прошёл count==0, его commit упадёт с
      // serialization-failure.
      { isolationLevel: "Serializable" }
    );
    created = result;
  } catch (err) {
    if (err instanceof BulkCopyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  // suppress unused — используется внутри tx, обнуление логируется ниже.
  void yesterdayEntriesLen;

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
