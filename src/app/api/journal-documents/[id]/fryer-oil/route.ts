import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { normalizeFryerOilEntryData, FRYER_OIL_TEMPLATE_CODE } from "@/lib/fryer-oil-document";
import { getServerSession } from "@/lib/server-session";
import { canWriteJournal } from "@/lib/journal-acl";
import { trialWriteGate } from "@/lib/trial-limits.server";

async function resolveEmployeeId(
  sessionUserId: string,
  organizationId: string
): Promise<string | null> {
  // Прежде всего — текущий юзер. Раньше API всегда выбирал
  // alphabetically-first сотрудника, и записи приписывались
  // не тому, кто реально менял масло. Теперь — сам автор
  // как employee.
  const me = await db.user.findFirst({
    where: { id: sessionUserId, organizationId, isActive: true },
    select: { id: true },
  });
  if (me) return me.id;
  // ROOT-impersonation fallback: ROOT (organizationId="platform")
  // не относится к импер-org-е, поэтому ставим первого активного
  // сотрудника, чтобы запись жила.
  const fallback = await db.user.findFirst({
    where: { organizationId, isActive: true },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return fallback?.id ?? null;
}

function toTimestamp(data: {
  startDate: string;
  startHour: number | null;
  startMinute: number | null;
}) {
  // Время может быть не заполнено (строка-заготовка на день) — тогда
  // ключом даты служит полночь, а не «null:null».
  const hour = String(data.startHour ?? 0).padStart(2, "0");
  const minute = String(data.startMinute ?? 0).padStart(2, "0");
  return new Date(`${data.startDate}T${hour}:${minute}:00.000Z`);
}

/**
 * Сколько строк помещается в одну минуту журнала.
 *
 * В таблице стоит @@unique([documentId, employeeId, date]), а у всех
 * фритюрниц одного дня время начала совпадает — метки разводятся
 * сдвигом внутри минуты. Сдвиг был секундным и упирался в 60 строк на
 * день; в заведении может стоять и сотня фритюрниц, поэтому шаг —
 * миллисекунда.
 */
const MAX_OFFSET_MS = 60_000;

/** Потолок на одну отправку: защита от случайной пачки в миллион строк. */
const MAX_BATCH_ITEMS = 500;

function isValidDate(value: Date) {
  return Number.isFinite(value.getTime());
}

async function getDocument(documentId: string, organizationId: string) {
  return db.journalDocument.findFirst({
    where: { id: documentId, organizationId },
    include: { template: { select: { code: true } } },
  });
}

/**
 * Свободные метки времени для строк одного дня.
 *
 * Занятые метки читаются одним запросом на минуту, а не по одной на
 * попытку: при сотне фритюрниц это была сотня round-trip'ов подряд.
 * Внутри пачки метки тоже резервируются — иначе две новые строки
 * получили бы одинаковую дату и упали на unique-констрейнте.
 */
async function reserveUniqueDates(
  documentId: string,
  employeeId: string,
  items: ReturnType<typeof normalizeFryerOilEntryData>[],
  currentId?: string
): Promise<Date[]> {
  const takenByMinute = new Map<number, Set<number>>();
  const dates: Date[] = [];

  for (const data of items) {
    const base = toTimestamp(data);
    if (!isValidDate(base)) {
      // Невалидную дату отдаём как есть — вызывающий её проверит и
      // ответит 400 с понятной причиной.
      dates.push(base);
      continue;
    }

    const baseMs = base.getTime();
    let taken = takenByMinute.get(baseMs);
    if (!taken) {
      const rows = await db.journalDocumentEntry.findMany({
        where: {
          documentId,
          employeeId,
          date: { gte: base, lt: new Date(baseMs + MAX_OFFSET_MS) },
          ...(currentId ? { NOT: { id: currentId } } : {}),
        },
        select: { date: true },
      });
      taken = new Set(rows.map((row) => row.date.getTime() - baseMs));
      takenByMinute.set(baseMs, taken);
    }

    let offset = 0;
    while (offset < MAX_OFFSET_MS && taken.has(offset)) offset += 1;
    if (offset >= MAX_OFFSET_MS) {
      throw new Error("Слишком много записей на одно и то же время");
    }
    taken.add(offset);
    dates.push(new Date(baseMs + offset));
  }

  return dates;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const orgId = getActiveOrgId(session);
  const document = await getDocument(documentId, orgId);
  if (!document || document.template?.code !== FRYER_OIL_TEMPLATE_CODE) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }
  if (document.status === "closed") {
    return NextResponse.json({ error: "Документ закрыт" }, { status: 400 });
  }
  const aclActor = {
    id: session.user.id,
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  };
  if (!(await canWriteJournal(aclActor, FRYER_OIL_TEMPLATE_CODE))) {
    return NextResponse.json({ error: "Нет доступа к этому журналу" }, { status: 403 });
  }

  // Две формы тела. `items` — пачка строк за один день (несколько
  // фритюрниц), `data` — одна строка. Старая форма осталась рабочей:
  // на неё завязаны прежние вызовы клиента.
  const body = (await request.json().catch(() => null)) as
    | { data?: unknown; items?: unknown }
    | null;
  const rawItems = Array.isArray(body?.items) ? body.items : [body?.data];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "Нет записей для сохранения" }, { status: 400 });
  }
  if (rawItems.length > MAX_BATCH_ITEMS) {
    return NextResponse.json(
      { error: `За один раз можно создать не больше ${MAX_BATCH_ITEMS} записей` },
      { status: 400 }
    );
  }
  const items = rawItems.map((item) => normalizeFryerOilEntryData(item));
  const employeeId = await resolveEmployeeId(session.user.id, orgId);
  if (!employeeId) {
    return NextResponse.json({ error: "Нет активных сотрудников для создания записи" }, { status: 400 });
  }

  const dates = await reserveUniqueDates(documentId, employeeId, items);
  if (dates.some((date) => !isValidDate(date))) {
    return NextResponse.json({ error: "Некорректная дата записи" }, { status: 400 });
  }

  const limited = await trialWriteGate(orgId, items.length);
  if (limited) return limited;

  // Транзакцией: полусохранённый день хуже несохранённого — человек не
  // поймёт, какие фритюрницы уже записаны, а какие нет.
  const entries = await db.$transaction(
    items.map((data, index) =>
      db.journalDocumentEntry.create({
        data: { documentId, employeeId, date: dates[index], data },
      })
    )
  );

  // `entry` — для прежних вызовов, которые ждут одну запись.
  return NextResponse.json({ entries, entry: entries[0] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const document = await getDocument(documentId, getActiveOrgId(session));
  if (!document || document.template?.code !== FRYER_OIL_TEMPLATE_CODE) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }
  if (document.status === "closed") {
    return NextResponse.json({ error: "Документ закрыт" }, { status: 400 });
  }
  const aclActor = {
    id: session.user.id,
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  };
  if (!(await canWriteJournal(aclActor, FRYER_OIL_TEMPLATE_CODE))) {
    return NextResponse.json({ error: "Нет доступа к этому журналу" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string; data?: unknown } | null;
  if (!body?.id) return NextResponse.json({ error: "Не указан идентификатор записи" }, { status: 400 });

  const current = await db.journalDocumentEntry.findFirst({
    where: { id: body.id, documentId },
    select: { id: true, employeeId: true },
  });
  if (!current) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

  const data = normalizeFryerOilEntryData(body.data);
  const [date] = await reserveUniqueDates(
    documentId,
    current.employeeId,
    [data],
    current.id
  );
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Некорректная дата записи" }, { status: 400 });
  }
  const limited = await trialWriteGate(getActiveOrgId(session));
  if (limited) return limited;

  const entry = await db.journalDocumentEntry.update({
    where: { id: current.id },
    data: { date, data },
  });

  return NextResponse.json({ entry });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: documentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const document = await getDocument(documentId, getActiveOrgId(session));
  if (!document || document.template?.code !== FRYER_OIL_TEMPLATE_CODE) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }
  if (document.status === "closed") {
    return NextResponse.json({ error: "Документ закрыт" }, { status: 400 });
  }
  // Удаление только при canWrite — read-only доступ не должен пускать
  // через DELETE.
  const aclActor = {
    id: session.user.id,
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  };
  if (!(await canWriteJournal(aclActor, FRYER_OIL_TEMPLATE_CODE))) {
    return NextResponse.json({ error: "Нет доступа к этому журналу" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "Нужно передать ids" }, { status: 400 });
  }

  const result = await db.journalDocumentEntry.deleteMany({
    where: { documentId, id: { in: body.ids } },
  });

  return NextResponse.json({ deleted: result.count });
}
