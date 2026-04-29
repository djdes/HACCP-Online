import { NextResponse } from "next/server";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { resolveJournalPeriod, parseJournalPeriodsJson } from "@/lib/journal-period";
import { prefillResponsiblesForNewDocument } from "@/lib/journal-responsibles-cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/settings/journal-responsibles/recreate-documents
 *
 * Закрывает все активные документы и создаёт новые с дефолтным
 * config'ом и подтянутыми из settings ответственными. Полезно когда:
 *   - старые документы имели мусорный или пустой config (нет rows,
 *     неправильные позиции, тестовые данные)
 *   - сменилась структура журнала или схема ответственных
 *   - просто хочется начать с чистого листа после быстрой настройки
 *
 * Существующие entries (заполненные строки) — НЕ удаляем, они
 * привязаны к старому document.id и остаются в нём (со статусом
 * closed). Если потом понадобятся для отчёта — можно открыть закрытый
 * документ и посмотреть.
 *
 * Отдельно для журналов которые не считаются «daily/monthly» (вроде
 * план обучения на год) — пересоздание происходит только если период
 * у нового документа отличается от старого. Иначе оставляем как есть.
 */
export async function POST() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasCapability(session.user, "admin.full")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const organizationId = getActiveOrgId(session);
  const now = new Date();

  const [templates, org] = await Promise.all([
    db.journalTemplate.findMany({
      where: { code: { in: ACTIVE_JOURNAL_CATALOG.map((j) => j.code) } },
      select: { id: true, code: true, name: true },
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { journalPeriods: true, disabledJournalCodes: true },
    }),
  ]);

  const overrides = parseJournalPeriodsJson(org?.journalPeriods ?? null);
  const disabledCodes = new Set<string>(
    Array.isArray(org?.disabledJournalCodes)
      ? (org!.disabledJournalCodes as unknown[]).filter(
          (c): c is string => typeof c === "string"
        )
      : []
  );

  let closed = 0;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const tpl of templates) {
    if (disabledCodes.has(tpl.code)) {
      skipped += 1;
      continue;
    }
    try {
      // Закрываем все active документы этого шаблона.
      const existing = await db.journalDocument.findMany({
        where: { organizationId, templateId: tpl.id, status: "active" },
        select: { id: true },
      });
      if (existing.length > 0) {
        await db.journalDocument.updateMany({
          where: {
            id: { in: existing.map((d) => d.id) },
          },
          data: { status: "closed" },
        });
        closed += existing.length;
      }

      // Создаём свежий документ на текущий период с подтянутыми из
      // settings ответственными и дефолтным config'ом.
      const period = resolveJournalPeriod(tpl.code, now, overrides);
      const prefill = await prefillResponsiblesForNewDocument({
        organizationId,
        journalCode: tpl.code,
        baseConfig: {},
      });
      await db.journalDocument.create({
        data: {
          organizationId,
          templateId: tpl.id,
          title: `${tpl.name} · ${period.label}`,
          dateFrom: period.dateFrom,
          dateTo: period.dateTo,
          status: "active",
          config: prefill.config as never,
          responsibleUserId: prefill.responsibleUserId,
        },
      });
      created += 1;
    } catch (err) {
      errors.push(
        `${tpl.code}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  await db.auditLog.create({
    data: {
      organizationId,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? null,
      action: "journal.recreate_documents",
      entity: "JournalDocument",
      entityId: organizationId,
      details: {
        closed,
        created,
        skipped,
        errorsCount: errors.length,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    closed,
    created,
    skipped,
    errors: errors.slice(0, 10),
    errorsTotal: errors.length,
  });
}
