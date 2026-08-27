import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { reconcileEntryStaffFields } from "@/lib/journal-staff-binding";
import { isManagementRole } from "@/lib/user-roles";
import { detectTemperatureCapas } from "@/lib/capa-auto-detect";
import {
  canEditAutomationCell,
  canEditEntryAt,
  isCellLocked,
  PAST_DAY_LOCKED_MESSAGE,
  type AutomationLockContext,
} from "@/lib/closed-day";
import { isJournalAutomationEnabled } from "@/lib/journal-automation";
import { canWriteJournal } from "@/lib/journal-acl";

/**
 * Fire-and-forget авто-детектор CAPA по температуре. Дёргается после
 * каждой записи в документ `cold_equipment_control` — если среди трёх
 * последних дней по одному и тому же холодильнику есть отклонение от
 * нормы, detectTemperatureCapas откроет CAPA с заготовленным планом
 * «проверить компрессор». Идемпотентно.
 */
function maybeTriggerColdEquipmentCapaDetection(
  templateCode: string | undefined,
  organizationId: string
): void {
  if (templateCode !== "cold_equipment_control") return;
  detectTemperatureCapas({ organizationId }).catch((err) => {
    console.warn("[capa-auto] cold-equipment detect failed:", err);
  });
}

/**
 * Контекст правила «изменения день в день» для документа.
 *
 * Живёт отдельно от `Organization.lockPastDayEdits`: тот тумблер
 * опциональный и пускает management, а автоматика запирает прошлые дни
 * для ВСЕХ, кроме ROOT (см. closed-day.ts). Иначе смысл автозаполнения
 * теряется: сайт проставил «Здоров» всем, а вчера кто-то дописал
 * «был с температурой» — и журнал перестаёт быть доказательством.
 */
async function loadAutomationLockContext(doc: {
  organizationId: string;
  autoFill: boolean;
  template?: { code: string } | null;
}): Promise<AutomationLockContext> {
  const org = await db.organization.findUnique({
    where: { id: doc.organizationId },
    select: {
      shiftEndHour: true,
      journalAutomationJson: true,
      autoJournalCodes: true,
    },
  });
  return {
    documentAutoFill: doc.autoFill === true,
    automationEnabled: Boolean(
      doc.template?.code && isJournalAutomationEnabled(org, doc.template.code)
    ),
    shiftEndHour: org?.shiftEndHour ?? 0,
  };
}

/** Лог ROOT-override — событие, на которое смотрит ХАССП-аудит. */
async function logPastDayOverride(args: {
  organizationId: string;
  userId: string;
  userName: string | null;
  documentId: string;
  employeeId: string | null;
  date: Date;
  templateCode: string | null;
}) {
  await db.auditLog.create({
    data: {
      organizationId: args.organizationId,
      userId: args.userId,
      userName: args.userName,
      action: "closed_day.override",
      entity: "journal_document_entry",
      entityId: args.documentId,
      details: {
        documentId: args.documentId,
        employeeId: args.employeeId,
        date: args.date.toISOString(),
        templateCode: args.templateCode,
        rule: "journal_automation",
      },
    },
  });
}

function isValidDate(value: Date) {
  return Number.isFinite(value.getTime());
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

/**
 * PUT — upsert a single grid cell (employee + date + data).
 * Called on each cell edit in the grid UI.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const doc = await db.journalDocument.findUnique({
    where: { id: documentId },
    include: { template: { select: { code: true } } },
  });
  if (!doc || doc.organizationId !== getActiveOrgId(session)) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (doc.status === "closed") {
    return NextResponse.json({ error: "Документ закрыт" }, { status: 400 });
  }

  // ACL: PUT не проверял canWriteJournal — любой authenticated юзер мог
  // через прямой fetch писать в grid любого journal-документа org-и.
  const aclActor = {
    id: session.user.id,
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  };
  if (doc.template?.code && !(await canWriteJournal(aclActor, doc.template.code))) {
    return NextResponse.json({ error: "Нет доступа к этому журналу" }, { status: 403 });
  }

  const body = await request.json();
  const { employeeId, date, data } = body;

  if (!employeeId || !date || !data) {
    return NextResponse.json({ error: "employeeId, date, data обязательны" }, { status: 400 });
  }

  // Аккаунтабилити: рядовой сотрудник может править только СВОЮ строку.
  // Раньше принимался произвольный employeeId из body — Алёна могла
  // через прямой fetch записать «выполнено» на строку коллеги Бори,
  // подделать его подпись в журнале гигиены и т.п.
  if (
    !isManagementRole(session.user.role) &&
    !session.user.isRoot &&
    employeeId !== session.user.id
  ) {
    return NextResponse.json(
      { error: "Можно редактировать только свою строку" },
      { status: 403 }
    );
  }

  // Verify employee belongs to org
  const employee = await db.user.findFirst({
    where: { id: employeeId, organizationId: getActiveOrgId(session) },
  });
  if (!employee) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }

  // Truncate to date-only (midnight UTC)
  const dateObj = new Date(date);
  if (!isValidDate(dateObj)) {
    return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
  }
  dateObj.setUTCHours(0, 0, 0, 0);

  const docDateFrom = new Date(doc.dateFrom);
  docDateFrom.setUTCHours(0, 0, 0, 0);
  const docDateTo = new Date(doc.dateTo);
  docDateTo.setUTCHours(0, 0, 0, 0);

  if (dateObj < docDateFrom || dateObj > docDateTo) {
    return NextResponse.json(
      { error: "Дата записи должна попадать в период документа" },
      { status: 400 }
    );
  }

  // Жёсткое правило автоматики «день в день» — строже, чем
  // lockPastDayEdits, и действует на все роли кроме ROOT.
  const automationCtx = await loadAutomationLockContext(doc);
  const automationDecision = canEditAutomationCell(
    dateObj,
    { role: session.user.role, isRoot: session.user.isRoot === true },
    automationCtx
  );
  if (!automationDecision.allowed) {
    return NextResponse.json(
      { error: PAST_DAY_LOCKED_MESSAGE, code: "past_day_locked" },
      { status: 403 }
    );
  }
  if (automationDecision.isOverride) {
    await logPastDayOverride({
      organizationId: doc.organizationId,
      userId: session.user.id,
      userName: session.user.name ?? null,
      documentId,
      employeeId,
      date: dateObj,
      templateCode: doc.template?.code ?? null,
    });
  }

  // «Закрытый день»: рядовой сотрудник не может править прошедшие
  // дни, если org.lockPastDayEdits=true. Management — может, но
  // мы запишем override в AuditLog.
  const orgConfig = await db.organization.findUnique({
    where: { id: doc.organizationId },
    select: { lockPastDayEdits: true, shiftEndHour: true },
  });
  if (orgConfig) {
    const decision = canEditEntryAt(
      dateObj,
      { role: session.user.role, isRoot: session.user.isRoot === true },
      orgConfig
    );
    if (!decision.allowed) {
      return NextResponse.json(
        {
          error:
            "День закрыт. Рядовые сотрудники не могут редактировать записи прошедших дней.",
          code: "past_day_locked",
        },
        { status: 403 }
      );
    }
    if (decision.isOverride) {
      // Лог переопределения — событие на которое смотрит ХАССП-аудит.
      await db.auditLog.create({
        data: {
          organizationId: doc.organizationId,
          userId: session.user.id,
          userName: session.user.name ?? null,
          action: "closed_day.override",
          entity: "journal_document_entry",
          entityId: documentId,
          details: {
            documentId,
            employeeId,
            date: dateObj.toISOString(),
            templateCode: doc.template?.code ?? null,
          },
        },
      });
    }
  }

  const entry = await db.journalDocumentEntry.upsert({
    where: {
      documentId_employeeId_date: {
        documentId,
        employeeId,
        date: dateObj,
      },
    },
    update: { data: toPrismaJsonValue(reconcileEntryStaffFields(data, employee)) },
    create: {
      documentId,
      employeeId,
      date: dateObj,
      data: toPrismaJsonValue(reconcileEntryStaffFields(data, employee)),
    },
  });

  maybeTriggerColdEquipmentCapaDetection(
    doc.template?.code,
    getActiveOrgId(session)
  );

  return NextResponse.json({ entry });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  if (!isManagementRole(session.user.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const doc = await db.journalDocument.findUnique({
    where: { id: documentId },
    include: { template: { select: { code: true } } },
  });
  if (!doc || doc.organizationId !== getActiveOrgId(session)) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (doc.status === "closed") {
    return NextResponse.json({ error: "Документ закрыт" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { entries?: Array<{ employeeId?: string; date?: string; data?: unknown }> }
    | null;

  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json({ error: "entries должны быть массивом" }, { status: 400 });
  }

  const payloadEntries = body.entries;
  const docDateFrom = new Date(doc.dateFrom);
  docDateFrom.setUTCHours(0, 0, 0, 0);
  const docDateTo = new Date(doc.dateTo);
  docDateTo.setUTCHours(0, 0, 0, 0);

  const candidateEmployeeIds = [...new Set(
    payloadEntries
      .map((entry) => (entry?.employeeId ? String(entry.employeeId) : ""))
      .filter(Boolean)
  )];
  const employees = await db.user.findMany({
    where: {
      id: { in: candidateEmployeeIds },
      organizationId: getActiveOrgId(session),
    },
    select: { id: true, name: true, role: true, positionTitle: true },
  });

  const normalizedEntries: Array<{
    employeeId: string;
    date: Date;
    data: unknown;
  }> = payloadEntries.map((entry) => {
    if (!entry?.employeeId || !entry.date || entry.data === undefined) {
      throw new Error("employeeId, date, data обязательны");
    }

    const dateObj = new Date(entry.date);
    if (!isValidDate(dateObj)) {
      throw new Error("Некорректная дата");
    }
    dateObj.setUTCHours(0, 0, 0, 0);

    if (dateObj < docDateFrom || dateObj > docDateTo) {
      throw new Error("Дата записи должна попадать в период документа");
    }

    const employee = employees.find((item) => item.id === entry.employeeId);

    return {
      employeeId: entry.employeeId,
      date: dateObj,
      data: employee ? reconcileEntryStaffFields(entry.data, employee) : entry.data,
    };
  });

  // Автодокумент: пересобрать прошлые дни bulk-запросом тоже нельзя.
  const patchLockCtx = await loadAutomationLockContext(doc);
  const lockedEntry = normalizedEntries.find((entry) =>
    isCellLocked(entry.date, patchLockCtx)
  );
  if (lockedEntry && session.user.isRoot !== true) {
    return NextResponse.json(
      { error: PAST_DAY_LOCKED_MESSAGE, code: "past_day_locked" },
      { status: 403 }
    );
  }
  if (lockedEntry) {
    await logPastDayOverride({
      organizationId: doc.organizationId,
      userId: session.user.id,
      userName: session.user.name ?? null,
      documentId,
      employeeId: lockedEntry.employeeId,
      date: lockedEntry.date,
      templateCode: doc.template?.code ?? null,
    });
  }

  const uniqueEmployeeIds = [...new Set(normalizedEntries.map((entry) => entry.employeeId))];

  if (employees.length !== uniqueEmployeeIds.length) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      await Promise.all(
        normalizedEntries.map((entry) =>
          tx.journalDocumentEntry.upsert({
            where: {
              documentId_employeeId_date: {
                documentId,
                employeeId: entry.employeeId,
                date: entry.date,
              },
            },
            update: { data: toPrismaJsonValue(entry.data) },
            create: {
              documentId,
              employeeId: entry.employeeId,
              date: entry.date,
              data: toPrismaJsonValue(entry.data),
            },
          })
        )
      );

      const staleEntries = await tx.journalDocumentEntry.findMany({
        where: { documentId },
        select: { id: true, employeeId: true, date: true },
      });

      const keepKeys = new Set(
        normalizedEntries.map((entry) => `${entry.employeeId}:${entry.date.toISOString()}`)
      );
      const deleteIds = staleEntries
        .filter((entry) => !keepKeys.has(`${entry.employeeId}:${entry.date.toISOString()}`))
        .map((entry) => entry.id);

      if (deleteIds.length > 0) {
        await tx.journalDocumentEntry.deleteMany({
          where: {
            documentId,
            id: { in: deleteIds },
          },
        });
      }

      return tx.journalDocumentEntry.findMany({
        where: { documentId },
        orderBy: [{ employeeId: "asc" }, { date: "asc" }],
      });
    });

    maybeTriggerColdEquipmentCapaDetection(
      doc.template?.code,
      getActiveOrgId(session)
    );

    return NextResponse.json({ entries: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось сохранить записи" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  if (!isManagementRole(session.user.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const doc = await db.journalDocument.findUnique({
    where: { id: documentId },
    include: { template: { select: { code: true } } },
  });
  if (!doc || doc.organizationId !== getActiveOrgId(session)) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (doc.status === "closed") {
    return NextResponse.json({ error: "Документ закрыт" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: string[];
    employeeId?: string;
    date?: string;
  };

  // Удаление — тоже правка прошлого дня: в автодокументе строку за
  // вчера убрать нельзя, иначе запрет на редактирование обходится
  // «удалить и создать заново».
  const deleteLockCtx = await loadAutomationLockContext(doc);
  if (
    deleteLockCtx.documentAutoFill &&
    deleteLockCtx.automationEnabled &&
    session.user.isRoot !== true
  ) {
    const candidates = await db.journalDocumentEntry.findMany({
      where: {
        documentId,
        ...(Array.isArray(body.ids) && body.ids.length > 0
          ? { id: { in: body.ids } }
          : {}),
        ...(body.employeeId ? { employeeId: body.employeeId } : {}),
      },
      select: { date: true },
    });
    if (candidates.some((entry) => isCellLocked(entry.date, deleteLockCtx))) {
      return NextResponse.json(
        { error: PAST_DAY_LOCKED_MESSAGE, code: "past_day_locked" },
        { status: 403 }
      );
    }
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const result = await db.journalDocumentEntry.deleteMany({
      where: {
        documentId,
        id: { in: body.ids },
      },
    });

    return NextResponse.json({ deleted: result.count });
  }

  if (body.employeeId && body.date) {
    const dateObj = new Date(body.date);
    if (!isValidDate(dateObj)) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }
    dateObj.setUTCHours(0, 0, 0, 0);

    const result = await db.journalDocumentEntry.deleteMany({
      where: {
        documentId,
        employeeId: body.employeeId,
        date: dateObj,
      },
    });

    return NextResponse.json({ deleted: result.count });
  }

  if (body.employeeId) {
    const result = await db.journalDocumentEntry.deleteMany({
      where: {
        documentId,
        employeeId: body.employeeId,
      },
    });

    return NextResponse.json({ deleted: result.count });
  }

  return NextResponse.json(
    { error: "Нужно передать ids либо employeeId и date" },
    { status: 400 }
  );
}
