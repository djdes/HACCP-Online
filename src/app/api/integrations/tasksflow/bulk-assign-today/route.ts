import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import {
  TasksFlowError,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";
import { listAdapters } from "@/lib/tasksflow-adapters";
import {
  parseStringArray,
  selectBulkJournalTemplates,
  selectRowsForBulkAssign,
} from "@/lib/tasksflow-bulk-assign";
import { resolveJournalPeriod } from "@/lib/journal-period";
import { getTemplatesFilledToday } from "@/lib/today-compliance";
import { filterSubordinates, getManagerScope } from "@/lib/manager-scope";
import { listOnDutyToday } from "@/lib/work-shifts";
import { notifyManagement, type NotificationItem } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Отправить всем на заполнение» — one-click fan-out that creates TasksFlow
 * tasks for every enabled selected journal that is still unfilled today.
 * Per-employee journals fan out to staff; normal journals get one task.
 *
 *   POST /api/integrations/tasksflow/bulk-assign-today
 *   Auth: manager/head_chef session
 *   Body: {}
 *
 * Response:
 *   {
 *     created: N,        // TF tasks actually created
 *     alreadyLinked: N,  // rows that already had a TF task
 *     skipped: N,        // rows skipped (no TF user link for the worker)
 *     errors: N,         // TF API failures — partial success still commits
 *     byJournal: [{label, created, alreadyLinked, skipped, errors}]
 *   }
 *
 * Idempotent — calling twice in a row yields the second call as all
 * alreadyLinked. That's the whole point of «одним нажатием»: manager
 * taps the button whenever they want without worrying about duplicates.
 */

type JournalReport = {
  code: string;
  label: string;
  documentId: string | null;
  documentTitle: string | null;
  documentAutoCreated?: boolean;
  created: number;
  alreadyLinked: number;
  skipped: number;
  errors: number;
  skipReason?: string;
};

function currentMonthBounds(now: Date): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m, 1)),
    to: new Date(Date.UTC(y, m + 1, 0)),
  };
}

function monthLabel(now: Date): string {
  return now.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function dayKey(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasFullWorkspaceAccess({ role: session.user.role, isRoot: session.user.isRoot })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);

  const integration = await db.tasksFlowIntegration.findFirst({
    where: { organizationId, enabled: true },
  });
  if (!integration) {
    return NextResponse.json(
      {
        error:
          "Интеграция с TasksFlow не настроена. Подключите её на странице настроек.",
      },
      { status: 400 }
    );
  }

  // The selected set is every active template minus disabled journal codes.
  // Aperiodic templates are required here too, because this fan-out follows
  // the organization's journal settings, not the old daily-only subset.
  const [templates, org] = await Promise.all([
    db.journalTemplate.findMany({
      where: { isActive: true },
      // bonusAmountKopecks > 0 → шаблон фанаут-ится на всех eligible
      // (race-for-bonus). См. shouldFanOutToAll в tasksflow-bulk-assign.
      select: {
        id: true,
        code: true,
        name: true,
        bonusAmountKopecks: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { disabledJournalCodes: true },
    }),
  ]);
  const disabledCodes = new Set<string>(
    parseStringArray((org?.disabledJournalCodes ?? []) as unknown)
  );
  const scope = await getManagerScope(session.user.id, organizationId);
  const now = new Date();
  const filledTemplateIds = await getTemplatesFilledToday(
    organizationId,
    now,
    templates,
    disabledCodes,
    { treatAperiodicAsFilled: false }
  );

  const { targets: targetTemplates, skipped: hierarchySkipped } =
    selectBulkJournalTemplates({
      templates,
      disabledCodes,
      filledTemplateIds,
      scope,
    });

  const reports: JournalReport[] = hierarchySkipped.map(({ template, reason }) => ({
    code: template.code,
    label: template.name,
    documentId: null,
    documentTitle: null,
    created: 0,
    alreadyLinked: 0,
    skipped: 1,
    errors: 0,
    skipReason: reason,
  }));
  const notificationItems = new Map<string, NotificationItem>();
  for (const { template, reason } of hierarchySkipped) {
    notificationItems.set(template.code, {
      id: template.code,
      label: template.name,
      hint: reason,
    });
  }

  if (targetTemplates.length === 0) {
    if (notificationItems.size > 0) {
      await notifyManagement({
        organizationId,
        kind: "tasksflow.bulk_assign.skipped",
        dedupeKey: `tasksflow.bulk_assign.skipped:${dayKey(now)}`,
        title: "TasksFlow: часть журналов не отправлена",
        linkHref: "/settings/staff-hierarchy",
        linkLabel: "Проверить иерархию",
        items: [...notificationItems.values()],
      });
    }
    return NextResponse.json({
      created: 0,
      alreadyLinked: 0,
      skipped: reports.reduce((sum, report) => sum + report.skipped, 0),
      errors: 0,
      documentsCreated: 0,
      byJournal: reports,
      message: "Все выбранные журналы за сегодня уже заполнены.",
    });
  }

  const adapters = await listAdapters();
  const adapterByCode = new Map(adapters.map((a) => [a.meta.templateCode, a]));
  const client = tasksflowClientFor(integration);
  // Раньше: baseUrl = origin запроса. Когда nginx проксирует с upstream
  // localhost:3002 без сохранения Host, в task.journalLink улетал
  // "https://localhost:3002" — таски в TasksFlow становились некликабельны
  // (ссылка ведёт на localhost, недоступный с мобильника).
  // Теперь: предпочитаем явный NEXTAUTH_URL, fallback на origin запроса.
  const envBase = (process.env.NEXTAUTH_URL ?? "").trim();
  const requestOrigin = new URL(request.url).origin;
  const baseUrl =
    envBase && !envBase.includes("localhost") ? envBase : requestOrigin;

  // Pre-load the org's TF user-link table once — hot loop below does
  // per-worker lookups against this in-memory map.
  const [userLinks, onDutyUsers, activeUsersForScope] = await Promise.all([
    db.tasksFlowUserLink.findMany({
      where: { integrationId: integration.id, tasksflowUserId: { not: null } },
      select: { wesetupUserId: true, tasksflowUserId: true },
    }),
    listOnDutyToday(organizationId, now),
    db.user.findMany({
      where: { organizationId, isActive: true, archivedAt: null },
      select: { id: true, jobPositionId: true },
    }),
  ]);
  const tfUserIdByWesetup = new Map<string, number>();
  for (const link of userLinks) {
    if (link.tasksflowUserId !== null) {
      tfUserIdByWesetup.set(link.wesetupUserId, link.tasksflowUserId);
    }
  }
  const scopedUsers = filterSubordinates(activeUsersForScope, scope, session.user.id);
  const scopedUserIds = new Set(scopedUsers.map((user) => user.id));
  const scheduledUserIds = new Set(onDutyUsers.map((user) => user.userId));
  const candidateUserIds =
    scheduledUserIds.size > 0
      ? new Set(
          [...scheduledUserIds].filter((userId) => scopedUserIds.has(userId))
        )
      : scopedUserIds;
  const linkedUserIds = new Set(tfUserIdByWesetup.keys());

  function markJournalSkipped(report: JournalReport, reason: string) {
    report.skipReason = reason;
    report.skipped += 1;
    notificationItems.set(report.code, {
      id: report.code,
      label: report.label,
      hint: reason,
    });
  }

  for (const tpl of targetTemplates) {
    const report: JournalReport = {
      code: tpl.code,
      label: tpl.name,
      documentId: null,
      documentTitle: null,
      created: 0,
      alreadyLinked: 0,
      skipped: 0,
      errors: 0,
    };

    const adapter = adapterByCode.get(tpl.code);
    if (!adapter) {
      report.skipReason = "Адаптер не зарегистрирован";
      report.skipped += 1;
      if (report.skipReason) {
        notificationItems.set(report.code, {
          id: report.code,
          label: report.label,
          hint: report.skipReason,
        });
      }
      reports.push(report);
      continue;
    }

    // First active document covering today. If none exists, auto-create
    // a month-long document so the bulk-assign is actually useful — the
    // whole point of «одним нажатием» is that the manager doesn't have
    // to pre-seed documents for every daily journal.
    let doc = await db.journalDocument.findFirst({
      where: {
        organizationId,
        status: "active",
        template: { code: tpl.code },
        dateFrom: { lte: now },
        dateTo: { gte: now },
      },
      orderBy: { dateFrom: "desc" },
    });
    if (!doc) {
      // Период считаем через resolveJournalPeriod — половина журналов
      // на haccp-online создаётся не на полный месяц (гигиена/здоровье/
      // холод. оборуд. — на половину; медкнижки/обучение/аварии — на
      // год). Раньше тут всегда был monthBounds → документы создавались
      // некорректно.
      const period = resolveJournalPeriod(tpl.code, now);
      doc = await db.journalDocument.create({
        data: {
          organizationId,
          templateId: tpl.id,
          title: `${tpl.name} · ${period.label}`,
          dateFrom: period.dateFrom,
          dateTo: period.dateTo,
          status: "active",
          config: {},
        },
      });
      report.documentAutoCreated = true;
    }
    report.documentId = doc.id;
    report.documentTitle = doc.title;

    // Adapter rows + already-linked set for this doc.
    let adapterDocs;
    try {
      adapterDocs = await adapter.listDocumentsForOrg(organizationId);
    } catch (err) {
      console.error(
        `[bulk-assign-today] ${tpl.code} listDocumentsForOrg failed`,
        err
      );
      report.skipReason = "Ошибка адаптера";
      report.skipped += 1;
      if (report.skipReason) {
        notificationItems.set(report.code, {
          id: report.code,
          label: report.label,
          hint: report.skipReason,
        });
      }
      reports.push(report);
      continue;
    }
    const adapterDoc = adapterDocs.find((d) => d.documentId === doc.id);
    if (!adapterDoc || adapterDoc.rows.length === 0) {
      report.skipReason = "У журнала нет строк для назначения";
      report.skipped += 1;
      if (report.skipReason) {
        notificationItems.set(report.code, {
          id: report.code,
          label: report.label,
          hint: report.skipReason,
        });
      }
      reports.push(report);
      continue;
    }

    const existingLinks = await db.tasksFlowTaskLink.findMany({
      where: {
        integrationId: integration.id,
        journalDocumentId: doc.id,
      },
      select: { rowKey: true },
    });
    const takenRowKeys = new Set(existingLinks.map((l) => l.rowKey));
    const rowSelection = selectRowsForBulkAssign({
      journalCode: tpl.code,
      bonusAmountKopecks: tpl.bonusAmountKopecks,
      rows: adapterDoc.rows,
      takenRowKeys,
      onDutyUserIds: candidateUserIds,
      linkedUserIds,
    });
    report.alreadyLinked += rowSelection.alreadyLinked;
    if (rowSelection.skipReason) {
      markJournalSkipped(report, rowSelection.skipReason);
      reports.push(report);
      continue;
    }
    if (rowSelection.rows.length === 0) {
      reports.push(report);
      continue;
    }

    for (const row of rowSelection.rows) {
      if (takenRowKeys.has(row.rowKey)) {
        report.alreadyLinked += 1;
        continue;
      }
      if (!row.responsibleUserId) {
        report.skipped += 1;
        continue;
      }
      const tfUserId = tfUserIdByWesetup.get(row.responsibleUserId);
      if (!tfUserId) {
        report.skipped += 1;
        continue;
      }

      const title = adapter.titleForRow?.(row, adapterDoc) ?? row.label;
      const description = adapter.descriptionForRow?.(row, adapterDoc) ?? "";
      const schedule = adapter.scheduleForRow(row, adapterDoc);
      const category = `WeSetup · ${tpl.name}`;
      // Премия в рублях (см. /settings/journal-bonuses). Передаём в TF
      // как `task.price` — там же логика начисления при complete.
      // Также кладём в journalLink, чтобы клиентский бейдж читал
      // именно сконфигурированную сумму, а не hardcoded.
      const bonusRubles = Math.floor((tpl.bonusAmountKopecks ?? 0) / 100);

      let created;
      try {
        created = await client.createTask({
          title,
          workerId: tfUserId,
          requiresPhoto: false,
          isRecurring: true,
          weekDays: schedule.weekDays,
          monthDay: schedule.monthDay ?? null,
          category,
          description,
          price: bonusRubles > 0 ? bonusRubles : undefined,
        });
      } catch (err) {
        console.error(
          `[bulk-assign-today] createTask failed`,
          tpl.code,
          row.rowKey,
          err
        );
        report.errors += 1;
        continue;
      }

      const journalLink = JSON.stringify({
        kind: `wesetup-${tpl.code}`,
        baseUrl,
        integrationId: integration.id,
        documentId: doc.id,
        rowKey: row.rowKey,
        label: title,
        isFreeText: false,
        // Опциональная сумма премии в копейках. TasksFlow читает её
        // для бейджа «+N ₽» и для определения «race-for-bonus»
        // claim-логики (когда первый сделал — у всех остальных
        // карточка уезжает в «Сделано другими»).
        bonusAmountKopecks: tpl.bonusAmountKopecks ?? 0,
      });
      try {
        await client.updateTask(created.id, { journalLink } as never);
      } catch (err) {
        if (err instanceof TasksFlowError) {
          console.warn(
            `[bulk-assign-today] journalLink update non-fatal`,
            err.status,
            err.message
          );
        } else {
          console.error(`[bulk-assign-today] journalLink update failed`, err);
        }
      }

      await db.tasksFlowTaskLink.create({
        data: {
          integrationId: integration.id,
          journalCode: tpl.code,
          journalDocumentId: doc.id,
          rowKey: row.rowKey,
          tasksflowTaskId: created.id,
          remoteStatus: created.isCompleted ? "completed" : "active",
          lastDirection: "push",
        },
      });
      report.created += 1;
      takenRowKeys.add(row.rowKey);
    }

    reports.push(report);
  }

  const summary = reports.reduce(
    (acc, r) => {
      acc.created += r.created;
      acc.alreadyLinked += r.alreadyLinked;
      acc.skipped += r.skipped;
      acc.errors += r.errors;
      if (r.documentAutoCreated) acc.documentsCreated += 1;
      return acc;
    },
    {
      created: 0,
      alreadyLinked: 0,
      skipped: 0,
      errors: 0,
      documentsCreated: 0,
    }
  );

  if (summary.created > 0 || summary.alreadyLinked > 0 || summary.errors > 0) {
    await db.tasksFlowIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    });
  }

  if (notificationItems.size > 0) {
    await notifyManagement({
      organizationId,
      kind: "tasksflow.bulk_assign.skipped",
      dedupeKey: `tasksflow.bulk_assign.skipped:${dayKey(now)}`,
      title: "TasksFlow: часть журналов не отправлена",
      linkHref: "/settings/staff-hierarchy",
      linkLabel: "Проверить иерархию",
      items: [...notificationItems.values()],
    });
  }

  return NextResponse.json({ ...summary, byJournal: reports });
}
