import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { DAILY_JOURNAL_CODES } from "@/lib/daily-journal-codes";
import { NOT_AUTO_SEEDED } from "@/lib/journal-entry-filters";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/close-day
 *
 * Жмёт «Закрыть день одним кликом» на дашборде. Копирует вчерашние
 * записи в сегодня для ВСЕХ активных JournalDocumentEntry-based
 * ежедневных документов организации (hygiene, health_check,
 * climate_control, cold_equipment_control,
 * cleaning_ventilation_checklist, uv_lamp_runtime, fryer_oil).
 *
 * Идемпотентно: если у сотрудника уже есть строка за сегодня — не
 * перезаписывается (overwrite=false). Если за вчера у документа
 * пусто — пропускается.
 *
 * Доступно только management-ролям (владелец/менеджер/шеф). Body
 * принимает опциональный фильтр { templateCodes?: string[] } —
 * чтобы можно было закрыть день только по выбранным журналам;
 * по умолчанию обрабатываются все daily-doc-entry журналы.
 */

type Body = { templateCodes?: string[] };

function utcDayStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

function toPrismaJsonValue(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

type JournalSummary = {
  templateCode: string;
  templateName: string;
  documentId: string;
  documentTitle: string;
  copied: number;
  kept: number;
  skippedReason?: "no_yesterday" | "out_of_period" | "closed";
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (
    !hasFullWorkspaceAccess({
      role: session.user.role,
      isRoot: session.user.isRoot,
    })
  ) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const filterCodes = Array.isArray(body?.templateCodes)
    ? new Set(body.templateCodes.filter((c) => typeof c === "string"))
    : null;

  const organizationId = getActiveOrgId(session);

  const now = new Date();
  const today = utcDayStart(now);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // Ищем активные документы по daily-codes набору. Берём свежий
  // активный документ на сегодня — если у организации несколько,
  // используем самый поздно созданный.
  const codes = [...DAILY_JOURNAL_CODES].filter(
    (c) => !filterCodes || filterCodes.has(c)
  );

  const templates = await db.journalTemplate.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, name: true },
  });
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const docs = await db.journalDocument.findMany({
    where: {
      organizationId,
      status: "active",
      templateId: { in: templates.map((t) => t.id) },
    },
    select: {
      id: true,
      title: true,
      templateId: true,
      dateFrom: true,
      dateTo: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Per-template — берём первый (самый свежий) активный документ.
  const seenTpl = new Set<string>();
  const targetDocs = docs.filter((d) => {
    if (seenTpl.has(d.templateId)) return false;
    seenTpl.add(d.templateId);
    return true;
  });

  const summaries: JournalSummary[] = [];
  let totalCopied = 0;
  let totalKept = 0;

  for (const doc of targetDocs) {
    const tpl = templateById.get(doc.templateId);
    if (!tpl) continue;

    // Today must be within document's period.
    const dateFromUtc = utcDayStart(doc.dateFrom);
    const dateToUtcEnd = (() => {
      const end = utcDayStart(doc.dateTo);
      end.setUTCDate(end.getUTCDate() + 1);
      return end;
    })();

    if (today < dateFromUtc || today >= dateToUtcEnd) {
      summaries.push({
        templateCode: tpl.code,
        templateName: tpl.name,
        documentId: doc.id,
        documentTitle: doc.title,
        copied: 0,
        kept: 0,
        skippedReason: "out_of_period",
      });
      continue;
    }

    // _autoSeeded плейсхолдеры — пустые «болванки», которые
    // bulk-assign-today / sync-* проставляют как ожидаемый матрикс
    // (employee × day). Они НЕ являются заполненными данными, и:
    //  • Из «вчера» их исключаем — иначе copy-yesterday склонировал
    //    бы пустую болванку как «вчерашнее заполнение» Алёны.
    //  • Из «сегодня» их исключаем — иначе при наличии seeded-row
    //    у Алёны мы пропустили бы upsert (думая что у неё уже
    //    есть запись), хотя реально она ничего не вписала.
    const [yesterdayEntries, todayEntries] = await Promise.all([
      db.journalDocumentEntry.findMany({
        where: { documentId: doc.id, date: yesterday, ...NOT_AUTO_SEEDED },
        select: { employeeId: true, data: true },
      }),
      db.journalDocumentEntry.findMany({
        where: { documentId: doc.id, date: today, ...NOT_AUTO_SEEDED },
        select: { employeeId: true },
      }),
    ]);

    if (yesterdayEntries.length === 0) {
      summaries.push({
        templateCode: tpl.code,
        templateName: tpl.name,
        documentId: doc.id,
        documentTitle: doc.title,
        copied: 0,
        kept: todayEntries.length,
        skippedReason: "no_yesterday",
      });
      continue;
    }

    const todayFilledEmployeeIds = new Set(
      todayEntries.map((e) => e.employeeId)
    );

    let copied = 0;
    let kept = 0;
    for (const entry of yesterdayEntries) {
      if (todayFilledEmployeeIds.has(entry.employeeId)) {
        kept += 1;
        continue;
      }
      await db.journalDocumentEntry.upsert({
        where: {
          documentId_employeeId_date: {
            documentId: doc.id,
            employeeId: entry.employeeId,
            date: today,
          },
        },
        create: {
          documentId: doc.id,
          employeeId: entry.employeeId,
          date: today,
          data: toPrismaJsonValue(entry.data),
        },
        update: {
          data: toPrismaJsonValue(entry.data),
        },
      });
      copied += 1;
    }

    totalCopied += copied;
    totalKept += kept;
    summaries.push({
      templateCode: tpl.code,
      templateName: tpl.name,
      documentId: doc.id,
      documentTitle: doc.title,
      copied,
      kept,
    });
  }

  await logAudit({
    organizationId,
    userId: session.user.id,
    userName: session.user.name ?? undefined,
    action: "journal_entry.copy",
    entity: "journal_document",
    details: {
      via: "dashboard.close_day",
      totalCopied,
      totalKept,
      processed: summaries.length,
      yesterday: yesterday.toISOString().slice(0, 10),
      today: today.toISOString().slice(0, 10),
    },
  });

  return NextResponse.json({
    totalCopied,
    totalKept,
    processed: summaries.length,
    yesterdayKey: yesterday.toISOString().slice(0, 10),
    todayKey: today.toISOString().slice(0, 10),
    summaries,
  });
}
