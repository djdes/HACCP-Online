import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import {
  getDbRoleValuesWithLegacy,
  MANAGEMENT_ROLES,
} from "@/lib/user-roles";
import {
  extractTasksFlowBearer,
  getMatchingTasksFlowIntegrations,
} from "@/lib/tasksflow-auth";
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
import { prefillResponsiblesForNewDocument } from "@/lib/journal-responsibles-cascade";
import { seedEntriesForDocument } from "@/lib/journal-document-entries-seed";
import { ensureTasksflowUserLinks } from "@/lib/tasksflow-ensure-links";
import { bulkAssignRateLimiter } from "@/lib/rate-limit";
import { runWithConcurrency } from "@/lib/bounded-concurrency";
import { getTemplatesFilledToday } from "@/lib/today-compliance";
import { filterSubordinates, getManagerScope } from "@/lib/manager-scope";
import { listOnDutyToday } from "@/lib/work-shifts";
import { notifyManagement, type NotificationItem } from "@/lib/notifications";
import { timingSafeEqualStrings } from "@/lib/timing-safe";

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
  // Server-to-server trigger: после саморегистрации сотрудника по QR
  // /api/join/[token] делает internal-fetch сюда чтобы fan-out задач.
  // У него нет session-cookie, поэтому используем shared secret из env
  // и organizationId передаётся прямо в body. Секрет НЕ должен попадать
  // в публичные логи.
  const internalSecret = request.headers.get("x-internal-trigger");
  type BulkAssignBody = { force?: unknown; organizationId?: unknown };
  let body: BulkAssignBody | null = null;
  try {
    const parsed = (await request
      .clone()
      .json()
      .catch(() => null)) as BulkAssignBody | null;
    body = parsed;
  } catch {
    /* пустое тело — fall through */
  }
  const force = body?.force === true;
  const isInternal = timingSafeEqualStrings(
    internalSecret,
    process.env.INTERNAL_TRIGGER_SECRET
  );

  let organizationId: string;
  let actingUser: { id: string; name: string | null; email: string | null };

  if (isInternal) {
    if (typeof body?.organizationId !== "string" || !body.organizationId) {
      return NextResponse.json(
        { error: "organizationId required for internal trigger" },
        { status: 400 }
      );
    }
    organizationId = body.organizationId;
    // В internal-trigger нет session, но getManagerScope, AuditLog и
    // filterSubordinates ниже требуют acting userId. Подменяем на
    // первого active management-юзера этой org — он точно видит весь
    // штат, manager-scope не отсекает (full workspace access).
    const mgmt = await db.user.findFirst({
      where: {
        organizationId,
        isActive: true,
        archivedAt: null,
        role: {
          in: getDbRoleValuesWithLegacy(MANAGEMENT_ROLES),
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    });
    if (!mgmt) {
      return NextResponse.json(
        { error: "Нет management-юзера в org для server-side trigger" },
        { status: 400 }
      );
    }
    actingUser = mgmt;
  } else {
    // Сначала пробуем `Bearer tfk_…` — TasksFlow proxy шлёт ключ
    // интеграции без cookie. Подставляем management-юзера org как
    // actingUser, чтобы AuditLog/уведомления имели реального
    // пользователя (синтетический id здесь упёрся бы в FK).
    const presentedKey = extractTasksFlowBearer(
      request.headers.get("authorization") ?? "",
    );
    let bearerOrg: string | null = null;
    if (presentedKey) {
      const matches = await getMatchingTasksFlowIntegrations(presentedKey);
      if (matches.length === 0) {
        return NextResponse.json(
          { error: "Invalid TasksFlow API key" },
          { status: 401 },
        );
      }
      bearerOrg = matches[0].organizationId;
    }
    if (bearerOrg) {
      organizationId = bearerOrg;
      const mgmt = await db.user.findFirst({
        where: {
          organizationId,
          isActive: true,
          archivedAt: null,
          role: { in: getDbRoleValuesWithLegacy(MANAGEMENT_ROLES) },
        },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: "asc" },
      });
      if (!mgmt) {
        return NextResponse.json(
          { error: "Нет management-юзера в org для tfk-trigger" },
          { status: 400 },
        );
      }
      actingUser = mgmt;
    } else {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!hasFullWorkspaceAccess({ role: session.user.role, isRoot: session.user.isRoot })) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      organizationId = getActiveOrgId(session);
      actingUser = {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
      };
    }
  }

  // Rate-limit: 3 fan-out'а / 5 мин / org. Защита от случайного
  // двойного клика и CSRF-loop'а.
  if (!bulkAssignRateLimiter.consume(`bulk-assign:${organizationId}`)) {
    const ms = bulkAssignRateLimiter.remainingMs(
      `bulk-assign:${organizationId}`
    );
    return NextResponse.json(
      {
        error: `Слишком частый «Отправить всем». Подождите ${Math.ceil(ms / 1000)} секунд.`,
      },
      { status: 429 }
    );
  }

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

  if (force) {
    const wiped = await db.tasksFlowTaskLink.deleteMany({
      where: { integrationId: integration.id },
    });
    await db.auditLog.create({
      data: {
        organizationId,
        userId: actingUser.id,
        userName: actingUser.name ?? actingUser.email ?? null,
        action: "tasksflow.bulk_assign.force_wipe",
        entity: "TasksFlowTaskLink",
        entityId: integration.id,
        details: { wiped: wiped.count, internal: isInternal },
      },
    });
  }

  // Лёгкий sync TF-юзеров перед фан-аутом — избегаем «Дежурные
  // ответственные не привязаны к TasksFlow» когда админ только что
  // назначил ответственных в settings, а кто-то из них ещё не имеет
  // TasksFlowUserLink. Создаёт remote-юзеров для тех у кого есть
  // phone, линкует, тех у кого нет — пропускает молча. Если TF
  // недоступен — proceed without (warn в логе).
  const linkSyncResult = await ensureTasksflowUserLinks({
    organizationId,
    integration,
  });

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
        // taskScope нужен для journalLink — TF Dashboard разделяет
        // задачи на «Мои» / «Общие» по этому полю.
        taskScope: true,
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
  const scope = await getManagerScope(actingUser.id, organizationId);
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
  // Per-item href: клик по подзадаче в bell-панели ведёт прямо на
  // соответствующий журнал, а не на общий /settings/staff-hierarchy.
  // (Общий linkHref остаётся как fallback в шапке нотификации.)
  function pushSkippedItem(code: string, label: string, hint: string) {
    notificationItems.set(code, {
      id: code,
      label,
      hint,
      href: `/journals/${code}`,
    });
  }
  for (const { template, reason } of hierarchySkipped) {
    pushSkippedItem(template.code, template.name, reason);
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
  const [userLinks, onDutyUsers, activeUsersForScope, allAccessRows] =
    await Promise.all([
      db.tasksFlowUserLink.findMany({
        where: {
          integrationId: integration.id,
          tasksflowUserId: { not: null },
        },
        select: { wesetupUserId: true, tasksflowUserId: true },
      }),
      listOnDutyToday(organizationId, now),
      db.user.findMany({
        where: { organizationId, isActive: true, archivedAt: null },
        select: { id: true, jobPositionId: true },
      }),
      // Per-position journal access — нужно отфильтровать row'ы которые
      // adapter возвращает по всем employees: бармен/грузчик/повар не
      // должны попадать в чек-лист уборки. Если для шаблона нет ни одной
      // строки — back-compat: без фильтрации (доступно всем).
      db.jobPositionJournalAccess.findMany({
        where: { organizationId },
        select: { templateId: true, jobPositionId: true },
      }),
    ]);
  // Карта { templateId: Set<jobPositionId> }
  const allowedPositionsByTemplateId = new Map<string, Set<string>>();
  for (const row of allAccessRows) {
    const set =
      allowedPositionsByTemplateId.get(row.templateId) ?? new Set<string>();
    set.add(row.jobPositionId);
    allowedPositionsByTemplateId.set(row.templateId, set);
  }
  // Карта userId → jobPositionId, чтобы быстро проверить eligibility row.
  const positionByUserId = new Map<string, string | null>();
  for (const u of activeUsersForScope) {
    positionByUserId.set(u.id, u.jobPositionId);
  }
  const tfUserIdByWesetup = new Map<string, number>();
  for (const link of userLinks) {
    if (link.tasksflowUserId !== null) {
      tfUserIdByWesetup.set(link.wesetupUserId, link.tasksflowUserId);
    }
  }
  const scopedUsers = filterSubordinates(activeUsersForScope, scope, actingUser.id);
  const scopedUserIds = new Set(scopedUsers.map((user) => user.id));
  const scheduledUserIds = new Set(onDutyUsers.map((user) => user.userId));
  // Читаем org-флаг bulkAssignRespectShifts. По умолчанию false —
  // большинство орг'ов не держат график смен в актуальном виде, и
  // shift-фильтр приводил к тому что «Отправить всем» молча
  // пропускал почти все журналы. Если орг хочет учёт графика смен,
  // включает флаг в настройках.
  const orgFlags = await db.organization.findUnique({
    where: { id: organizationId },
    select: { bulkAssignRespectShifts: true },
  });
  const respectShifts = orgFlags?.bulkAssignRespectShifts === true;
  const candidateUserIds =
    respectShifts && scheduledUserIds.size > 0
      ? new Set(
          [...scheduledUserIds].filter((userId) => scopedUserIds.has(userId))
        )
      : scopedUserIds;
  const linkedUserIds = new Set(tfUserIdByWesetup.keys());

  function markJournalSkipped(report: JournalReport, reason: string) {
    report.skipReason = reason;
    report.skipped += 1;
    pushSkippedItem(report.code, report.label, reason);
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
        pushSkippedItem(report.code, report.label, report.skipReason);
      }
      reports.push(report);
      continue;
    }

    // First active document covering today. If none exists, auto-create
    // a month-long document so the bulk-assign is actually useful — the
    // whole point of «одним нажатием» is that the manager doesn't have
    // to pre-seed documents for every daily journal.
    //
    // 2026-04-30: сравниваем с началом UTC-дня, а не с `now`. Иначе для
    // monthly/half-monthly/single-day/yearly документ создаётся с
    // dateTo = 00:00 UTC последнего дня периода, а query
    // `dateTo: { gte: now }` где now=13:45 UTC возвращает false →
    // каждый клик «Разослать всем» плодил 15 новых документов
    // (только что починили).
    const todayUtcStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    let doc = await db.journalDocument.findFirst({
      where: {
        organizationId,
        status: "active",
        template: { code: tpl.code },
        dateFrom: { lte: todayUtcStart },
        dateTo: { gte: todayUtcStart },
      },
      orderBy: { dateFrom: "desc" },
      // Включаем verifierUserId — нужен для двухступенчатой проверки.
      // Селект целиком чтобы не терять остальные поля.
    });
    if (!doc) {
      // Период считаем через resolveJournalPeriod — половина журналов
      // на haccp-online создаётся не на полный месяц (гигиена/здоровье/
      // холод. оборуд. — на половину; медкнижки/обучение/аварии — на
      // год). Раньше тут всегда был monthBounds → документы создавались
      // некорректно.
      const period = resolveJournalPeriod(tpl.code, now);
      // Подтягиваем сохранённых в /settings/journal-responsibles
      // ответственных в config + responsibleUserId — чтобы новый
      // документ сразу открывался с заполненными ФИО, а не пустой.
      const prefill = await prefillResponsiblesForNewDocument({
        organizationId,
        journalCode: tpl.code,
        baseConfig: {},
      });
      doc = await db.journalDocument.create({
        data: {
          organizationId,
          templateId: tpl.id,
          title: `${tpl.name} · ${period.label}`,
          dateFrom: period.dateFrom,
          dateTo: period.dateTo,
          status: "active",
          autoFill: false,
          config: prefill.config as never,
          responsibleUserId: prefill.responsibleUserId,
          verifierUserId: prefill.verifierUserId,
        },
      });
      await seedEntriesForDocument({
        documentId: doc.id,
        journalCode: tpl.code,
        organizationId,
        dateFrom: doc.dateFrom,
        dateTo: doc.dateTo,
        responsibleUserId: prefill.responsibleUserId,
      }).catch((err) => {
        console.warn(
          `[bulk-assign-today] seedEntries failed for ${tpl.code}`,
          err
        );
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
        pushSkippedItem(report.code, report.label, report.skipReason);
      }
      reports.push(report);
      continue;
    }
    const adapterDoc = adapterDocs.find((d) => d.documentId === doc.id);
    if (!adapterDoc || adapterDoc.rows.length === 0) {
      report.skipReason = "У журнала нет строк для назначения";
      report.skipped += 1;
      if (report.skipReason) {
        pushSkippedItem(report.code, report.label, report.skipReason);
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

    // Фильтр rows по per-position journal access. Если для шаблона
    // настроены какие-то «разрешённые должности» — оставляем только
    // тех responsible, чья должность входит в этот набор. Если access
    // пуст для шаблона — пропускаем (легаси-режим «всем»).
    const allowedPositionIdsForTpl = allowedPositionsByTemplateId.get(tpl.id);
    const filteredRows =
      allowedPositionIdsForTpl && allowedPositionIdsForTpl.size > 0
        ? adapterDoc.rows.filter((row) => {
            if (!row.responsibleUserId) return true; // generic / shared rows
            const pid = positionByUserId.get(row.responsibleUserId);
            return pid != null && allowedPositionIdsForTpl.has(pid);
          })
        : adapterDoc.rows;

    const rowSelection = selectRowsForBulkAssign({
      journalCode: tpl.code,
      bonusAmountKopecks: tpl.bonusAmountKopecks,
      rows: filteredRows,
      takenRowKeys,
      onDutyUserIds: candidateUserIds,
      linkedUserIds,
      // Пробрасываем флаг чтобы текст ошибки и fallback-логика были
      // адекватны: при respectShifts=false (default) onDuty == scope,
      // а не реальный график.
      respectShifts: respectShifts && scheduledUserIds.size > 0,
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

    // Concurrency cap: дёргаем TF createTask пачками по 5 параллельно.
    // Раньше sequential — 15 row'ов × ~1.5s/row = 22+s. Теперь 5
    // параллельно → ~5s на пачку. TF rate-limit-friendly: 5 одновременно
    // не сильно бьёт по их API.
    await runWithConcurrency(rowSelection.rows, 5, async (row) => {
      if (takenRowKeys.has(row.rowKey)) {
        report.alreadyLinked += 1;
        return;
      }
      if (!row.responsibleUserId) {
        report.skipped += 1;
        return;
      }
      const tfUserId = tfUserIdByWesetup.get(row.responsibleUserId);
      if (!tfUserId) {
        report.skipped += 1;
        return;
      }

      const title = adapter.titleForRow?.(row, adapterDoc) ?? row.label;
      const description = adapter.descriptionForRow?.(row, adapterDoc) ?? "";
      const schedule = adapter.scheduleForRow(row, adapterDoc);
      const category = `WeSetup · ${tpl.name}`;
      const bonusRubles = Math.floor((tpl.bonusAmountKopecks ?? 0) / 100);

      // Phase C двухстадийной верификации: verifier — отдельная
      // роль от исполнителя. Источник:
      //   1. doc.verifierUserId (новое поле, выставленное в
      //      /settings/journal-responsibles → секция «Кто проверяет»).
      //   2. Fallback на doc.responsibleUserId — для документов
      //      созданных ДО разделения filler/verifier (back-compat).
      //
      // Если verifier == worker (одинокий случай — заведующая в смене
      // и сама отв. за заполнение и проверку) — не ставим, task
      // закрывается обычным /complete.
      const verifierWesetupId =
        doc.verifierUserId ?? doc.responsibleUserId ?? null;
      let verifierTfId: number | null = null;
      if (verifierWesetupId) {
        const candidate = tfUserIdByWesetup.get(verifierWesetupId);
        if (candidate && candidate !== tfUserId) {
          verifierTfId = candidate;
        }
      }

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
          verifierWorkerId: verifierTfId,
        });
      } catch (err) {
        console.error(
          `[bulk-assign-today] createTask failed`,
          tpl.code,
          row.rowKey,
          err
        );
        report.errors += 1;
        return;
      }

      const journalLink = JSON.stringify({
        kind: `wesetup-${tpl.code}`,
        baseUrl,
        integrationId: integration.id,
        documentId: doc.id,
        rowKey: row.rowKey,
        label: title,
        isFreeText: false,
        bonusAmountKopecks: tpl.bonusAmountKopecks ?? 0,
        taskScope: tpl.taskScope ?? "personal",
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

      try {
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
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "P2002") {
          report.alreadyLinked += 1;
        } else {
          report.errors += 1;
        }
      }
      takenRowKeys.add(row.rowKey);
    });

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

  return NextResponse.json({
    ...summary,
    byJournal: reports,
    tfUserSync: linkSyncResult,
  });
}
