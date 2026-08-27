/**
 * Автозаполнение «кадровых» журналов (гигиенический + журнал здоровья).
 *
 * Используется двумя точками входа:
 *   - POST /api/journal-documents/[id]/staff  (action=apply_auto_fill) —
 *     менеджер включает тумблер «Автоматически заполнять журнал»;
 *   - POST /api/cron/auto-fill-journals — ежедневный cron, дозаполняет
 *     ТОЛЬКО сегодняшний день.
 *
 * Правило эталона (haccp-online):
 *   - тумблер автозаполнения работает ЕЖЕДНЕВНО, а не однократно;
 *   - графики сотрудников (выходные / отпуска / больничные) проставляют
 *     статус ТОЛЬКО в ГИГИЕНИЧЕСКОМ журнале. На журнал здоровья и на
 *     любые другие журналы графики не влияют.
 *
 * Идемпотентность: пишем только в ПУСТЫЕ ячейки (и создаём недостающие
 * строки через createMany + skipDuplicates). Повторный прогон по уже
 * заполненному дню не делает ни одной записи.
 */
import type { PrismaClient } from "@prisma/client";
import {
  getDefaultEntryDataForTemplate,
  isEntryDataEmpty,
  toDateKey,
  type HygieneEntryData,
} from "@/lib/hygiene-document";
import {
  buildDayOffOverrides,
  dayOffOverrideKey,
  isStaffDayOff,
} from "@/lib/staff-days-off";

export const HYGIENE_TEMPLATE_CODE = "hygiene";
export const HEALTH_CHECK_TEMPLATE_CODE = "health_check";

export const STAFF_JOURNAL_TEMPLATE_CODES = [
  HYGIENE_TEMPLATE_CODE,
  HEALTH_CHECK_TEMPLATE_CODE,
] as const;

/** Статусы гигиенического журнала, которые может проставить график. */
export type StaffScheduleStatus = "day_off" | "vacation" | "sick_leave";

type ScheduleDb = Pick<
  PrismaClient,
  "staffWorkOffDay" | "staffVacation" | "staffSickLeave" | "user"
>;

type EntryDb = Pick<PrismaClient, "journalDocumentEntry">;

export type StaffScheduleMap = Map<string, StaffScheduleStatus>;

export function staffScheduleKey(employeeId: string, dateKey: string) {
  return `${employeeId}:${dateKey}`;
}

function utcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * Читает графики (выходные / отпуска / больничные) на диапазон дат и
 * складывает в map `employeeId:dateKey -> статус`.
 *
 * Приоритет при пересечении: больничный > отпуск > выходной.
 */
export async function loadStaffScheduleMap(
  db: ScheduleDb,
  params: { employeeIds: string[]; dateKeys: string[] }
): Promise<StaffScheduleMap> {
  const map: StaffScheduleMap = new Map();
  const { employeeIds } = params;
  const dateKeys = [...params.dateKeys].sort();
  if (employeeIds.length === 0 || dateKeys.length === 0) return map;

  const rangeStart = utcDate(dateKeys[0]);
  const rangeEnd = utcDate(dateKeys[dateKeys.length - 1]);
  const dateKeySet = new Set(dateKeys);

  const [offDays, staffUsers, vacations, sickLeaves] = await Promise.all([
    db.staffWorkOffDay.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { userId: true, date: true, kind: true },
    }),
    // Недельное правило выходных: без него в журнал попадали только те
    // дни, которые управляющая успела прокликать руками.
    db.user.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, weeklyDaysOff: true },
    }),
    db.staffVacation.findMany({
      where: {
        userId: { in: employeeIds },
        dateFrom: { lte: rangeEnd },
        dateTo: { gte: rangeStart },
      },
      select: { userId: true, dateFrom: true, dateTo: true },
    }),
    db.staffSickLeave.findMany({
      where: {
        userId: { in: employeeIds },
        dateFrom: { lte: rangeEnd },
        dateTo: { gte: rangeStart },
      },
      select: { userId: true, dateFrom: true, dateTo: true },
    }),
  ]);

  // Порядок важен: последующий тип перекрывает предыдущий.
  // Выходной = недельное правило сотрудника, скорректированное явными
  // отметками из StaffWorkOffDay (см. src/lib/staff-days-off.ts).
  const overrides = buildDayOffOverrides(
    offDays.filter((row) => dateKeySet.has(toDateKey(row.date)))
  );
  staffUsers.forEach((user) => {
    dateKeys.forEach((dateKey) => {
      const override = overrides.get(dayOffOverrideKey(user.id, dateKey));
      if (!isStaffDayOff(user, dateKey, override ?? null)) return;
      map.set(staffScheduleKey(user.id, dateKey), "day_off");
    });
  });

  function applyPeriods(
    periods: { userId: string; dateFrom: Date; dateTo: Date }[],
    status: StaffScheduleStatus
  ) {
    periods.forEach((period) => {
      const from = toDateKey(period.dateFrom);
      const to = toDateKey(period.dateTo);
      dateKeys.forEach((dateKey) => {
        if (dateKey < from || dateKey > to) return;
        map.set(staffScheduleKey(period.userId, dateKey), status);
      });
    });
  }

  applyPeriods(vacations, "vacation");
  applyPeriods(sickLeaves, "sick_leave");

  return map;
}

/**
 * Данные строки автозаполнения. Для гигиенического — статус из графика
 * («В» / «Отп» / «Б/л»), иначе дефолт («Зд.»). Для журнала здоровья —
 * всегда дефолт: графики на него не влияют (правило эталона).
 */
export function buildStaffAutoFillEntryData(
  templateCode: string,
  scheduleStatus?: StaffScheduleStatus
) {
  if (templateCode === HYGIENE_TEMPLATE_CODE && scheduleStatus) {
    return {
      status: scheduleStatus,
      temperatureAbove37: null,
    } satisfies HygieneEntryData;
  }

  return getDefaultEntryDataForTemplate(templateCode);
}

export type StaffAutoFillEntry = {
  id: string;
  employeeId: string;
  date: Date;
  data: unknown;
};

/**
 * Дозаполняет строки кадрового журнала на переданные даты.
 *
 * @param employeeIds сотрудники, для которых должны существовать строки
 * @param dateKeys    даты в формате YYYY-MM-DD (для cron — только сегодня)
 * @param entries     уже существующие строки документа
 */
export async function applyStaffJournalAutoFill(
  db: EntryDb & ScheduleDb,
  params: {
    documentId: string;
    templateCode: string;
    employeeIds: string[];
    dateKeys: string[];
    entries: StaffAutoFillEntry[];
  }
): Promise<{ created: number; updated: number }> {
  const { documentId, templateCode, employeeIds, dateKeys, entries } = params;
  if (dateKeys.length === 0) return { created: 0, updated: 0 };

  const schedule =
    templateCode === HYGIENE_TEMPLATE_CODE
      ? await loadStaffScheduleMap(db, { employeeIds, dateKeys })
      : (new Map() as StaffScheduleMap);

  const dateKeySet = new Set(dateKeys);
  const existingKeys = new Set(
    entries.map((entry) => staffScheduleKey(entry.employeeId, toDateKey(entry.date)))
  );

  const rowsToCreate = employeeIds.flatMap((employeeId) =>
    dateKeys
      .filter((dateKey) => !existingKeys.has(staffScheduleKey(employeeId, dateKey)))
      .map((dateKey) => ({
        documentId,
        employeeId,
        date: utcDate(dateKey),
        data: buildStaffAutoFillEntryData(
          templateCode,
          schedule.get(staffScheduleKey(employeeId, dateKey))
        ),
      }))
  );

  const created =
    rowsToCreate.length > 0
      ? (
          await db.journalDocumentEntry.createMany({
            data: rowsToCreate,
            skipDuplicates: true,
          })
        ).count
      : 0;

  // Дозаполняем только ПУСТЫЕ ячейки — ручные отметки не перетираем.
  const rowsToUpdate = entries.filter(
    (entry) => dateKeySet.has(toDateKey(entry.date)) && isEntryDataEmpty(entry.data)
  );

  await Promise.all(
    rowsToUpdate.map((entry) =>
      db.journalDocumentEntry.update({
        where: { id: entry.id },
        data: {
          data: buildStaffAutoFillEntryData(
            templateCode,
            schedule.get(staffScheduleKey(entry.employeeId, toDateKey(entry.date)))
          ),
        },
      })
    )
  );

  return { created, updated: rowsToUpdate.length };
}
