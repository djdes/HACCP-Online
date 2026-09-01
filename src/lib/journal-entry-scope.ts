import { isManagementRole } from "@/lib/user-roles";

/**
 * Кто и что вправе править в документе-бланке.
 *
 * Модуль намеренно чистый: ни Prisma, ни `db`, ни серверных импортов.
 * Ровно те же правила нужны браузеру — сетка должна ГАСИТЬ недоступные
 * ячейки, а не позволять их трогать и ловить отказ уже на сохранении.
 * Пока логика жила рядом с записью в базу, клиент импортировать её не
 * мог, и сотрудник видел редактируемую таблицу, из которой ничего не
 * сохранялось.
 */

/**
 * Кто в этом документе имеет полный доступ.
 *
 * Руководство и ответственный за журнал правят любые строки и любые дни
 * — им положено исправлять чужие ошибки, в том числе вчерашние. Рядовой
 * сотрудник заполняет только свою строку и только сегодня: журнал
 * санитарного контроля — это подтверждение, что проверка была проведена
 * в тот день, а запись задним числом такого подтверждения не даёт.
 */
export function hasFullDocumentAccess(args: {
  actor: { id: string; role: string; isRoot: boolean };
  responsibleUserId?: string | null;
}): boolean {
  if (args.actor.isRoot) return true;
  if (isManagementRole(args.actor.role)) return true;
  return Boolean(
    args.responsibleUserId && args.responsibleUserId === args.actor.id
  );
}

/**
 * Тексты отказов держим здесь же: их показывает и сервер в ответе, и
 * сетка в подсказке над закрытой ячейкой. Разъехавшиеся формулировки
 * читаются как два разных запрета.
 */
export const FOREIGN_ROW_MESSAGE = "Можно заполнять только свою строку";
export const NOT_TODAY_MESSAGE =
  "Заполнять можно только сегодняшний день. За прошлые дни правки вносит ответственный за журнал.";

export type EntryScopeDecision =
  | { allowed: true }
  | { allowed: false; error: string; code: "foreign_row" | "not_today" };

/**
 * Чья строка и за какой день — проверка ДО правил закрытого дня.
 *
 * Отдельно от `checkEntryWrite`, потому что отвечает на другой вопрос:
 * тот решает «не поздно ли править», этот — «твоё ли это вообще».
 */
export function checkEntryScope(args: {
  actor: { id: string; role: string; isRoot: boolean };
  responsibleUserId?: string | null;
  /** Чья строка правится. */
  employeeId: string;
  /** День строки, `YYYY-MM-DD`. */
  entryDayKey: string;
  /** Сегодня в часовом поясе организации, `YYYY-MM-DD`. */
  todayKey: string;
}): EntryScopeDecision {
  if (hasFullDocumentAccess(args)) return { allowed: true };

  if (args.employeeId !== args.actor.id) {
    return {
      allowed: false,
      error: FOREIGN_ROW_MESSAGE,
      code: "foreign_row",
    };
  }

  if (args.entryDayKey !== args.todayKey) {
    return {
      allowed: false,
      error: NOT_TODAY_MESSAGE,
      code: "not_today",
    };
  }

  return { allowed: true };
}
