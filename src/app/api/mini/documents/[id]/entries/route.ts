import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { canWriteJournal, hasJournalAccess } from "@/lib/journal-acl";
import {
  canEditAutomationCell,
  PAST_DAY_LOCKED_MESSAGE,
} from "@/lib/closed-day";
import { isJournalAutomationEnabled } from "@/lib/journal-automation";
import {
  checkEntryScope,
  hasFullDocumentAccess,
} from "@/lib/journal-entry-write";
import { orgTodayKey } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orgId = getActiveOrgId(session);

  const doc = await db.journalDocument.findFirst({
    where: { id, organizationId: orgId },
    include: {
      template: { select: { code: true, name: true, fields: true } },
      entries: {
        include: { employee: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await hasJournalAccess(
    { id: session.user.id, role: session.user.role, isRoot: session.user.isRoot === true },
    doc.template.code
  );
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ровно те же данные, по которым POST принимает решение: без них
  // Mini App рисует редактируемые карточки чужих сотрудников, и человек
  // узнаёт об отказе только при сохранении.
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  });
  const actor = {
    id: session.user.id,
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  };

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      dateFrom: doc.dateFrom,
      dateTo: doc.dateTo,
      status: doc.status,
      responsibleUserId: doc.responsibleUserId,
    },
    viewer: {
      userId: actor.id,
      fullAccess: hasFullDocumentAccess({
        actor,
        responsibleUserId: doc.responsibleUserId,
      }),
    },
    todayKey: orgTodayKey(org?.timezone ?? undefined),
    template: doc.template,
    entries: doc.entries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      employeeName: e.employee.name,
      date: e.date,
      data: e.data,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orgId = getActiveOrgId(session);

  const doc = await db.journalDocument.findFirst({
    where: { id, organizationId: orgId },
    include: { template: { select: { code: true } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ACL write-check: раньше любой authenticated мог писать в любой
  // журнал org'и. Теперь сверяем UserJournalAccess.canWrite.
  const access = await canWriteJournal(
    { id: session.user.id, role: session.user.role, isRoot: session.user.isRoot === true },
    doc.template.code
  );
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Closed-document immutability — согласовано с другими entry-routes.
  if (doc.status === "closed") {
    return NextResponse.json({ error: "Документ закрыт" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    employeeId?: string;
    date?: string;
    data?: Record<string, unknown>;
  };

  if (!body.employeeId || !body.date || !body.data) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // employeeId scope-check: раньше принимался любой UUID — можно
  // было создать entry с employeeId юзера ЧУЖОЙ компании (FK
  // ссылается, но в БД появлялся cross-tenant orphan).
  const employee = await db.user.findFirst({
    where: { id: body.employeeId, organizationId: orgId },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }

  // Тот же запрет, что в веб-роутах: рядовой сотрудник заполняет свою
  // строку и только сегодня. Здесь его не было вовсе — роут проверял
  // лишь принадлежность организации, и через прямой вызов можно было
  // записать что угодно в чужую строку за любой день.
  {
    const scopeOrg = await db.organization.findUnique({
      where: { id: orgId },
      select: { timezone: true },
    });
    const scope = checkEntryScope({
      actor: {
        id: session.user.id,
        role: session.user.role,
        isRoot: session.user.isRoot === true,
      },
      responsibleUserId: doc.responsibleUserId,
      employeeId: body.employeeId,
      entryDayKey: String(body.date).slice(0, 10),
      todayKey: orgTodayKey(scopeOrg?.timezone ?? undefined),
    });
    if (!scope.allowed) {
      return NextResponse.json(
        { error: scope.error, code: scope.code },
        { status: 403 }
      );
    }
  }

  // Date validation — раньше new Date("garbage") = InvalidDate
  // → Prisma бросала непонятный 500. И диапазон документа не
  // проверялся, можно было записать в произвольную дату.
  const date = new Date(body.date);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
  }
  date.setUTCHours(0, 0, 0, 0);
  const docDateFrom = new Date(doc.dateFrom);
  docDateFrom.setUTCHours(0, 0, 0, 0);
  const docDateTo = new Date(doc.dateTo);
  docDateTo.setUTCHours(0, 0, 0, 0);
  if (date < docDateFrom || date > docDateTo) {
    return NextResponse.json(
      { error: "Дата записи должна попадать в период документа" },
      { status: 400 }
    );
  }

  // П-3: правило «изменения день в день» должно работать одинаково на
  // сайте и в Mini App — иначе запрет обходится через телефон.
  const orgAutomation = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      shiftEndHour: true,
      journalAutomationJson: true,
      autoJournalCodes: true,
    },
  });
  const lockDecision = canEditAutomationCell(
    date,
    { role: session.user.role, isRoot: session.user.isRoot === true },
    {
      documentAutoFill: doc.autoFill === true,
      automationEnabled: isJournalAutomationEnabled(
        orgAutomation,
        doc.template.code
      ),
      shiftEndHour: orgAutomation?.shiftEndHour ?? 0,
    }
  );
  if (!lockDecision.allowed) {
    return NextResponse.json(
      { error: PAST_DAY_LOCKED_MESSAGE, code: "past_day_locked" },
      { status: 403 }
    );
  }

  const entry = await db.journalDocumentEntry.upsert({
    where: {
      documentId_employeeId_date: {
        documentId: id,
        employeeId: body.employeeId,
        date,
      },
    },
    update: { data: body.data as never },
    create: {
      documentId: id,
      employeeId: body.employeeId,
      date,
      data: body.data as never,
    },
  });

  return NextResponse.json({ entry });
}
