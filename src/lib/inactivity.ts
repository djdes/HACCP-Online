/**
 * Пауза за неактивность — чистая логика (без БД), чтобы её можно было
 * протестировать. Порог и стадии предупреждений — решение владельца
 * (2026-09-05): 100 дней без записей, письма за 30/14/7/3/2/1 день.
 */

export const INACTIVITY_PAUSE_DAYS = 100;

/** За сколько дней до паузы шлём предупреждение (по убыванию). */
export const INACTIVITY_WARNING_STAGES = [30, 14, 7, 3, 2, 1] as const;

export type InactivityStage = (typeof INACTIVITY_WARNING_STAGES)[number];

export type InactivityInput = {
  now: Date;
  /** Последняя запись в журналах; null — записей не было никогда. */
  lastActivityAt: Date | null;
  /** Для организаций без записей — точка отсчёта (создание). */
  createdAt: Date;
  /** Последняя отправленная стадия (дни) и для какой активности. */
  warnedStage: number | null;
  warnedForActivityAt: Date | null;
};

export type InactivityDecision =
  | { action: "none"; daysLeft: number; pauseAt: Date }
  | { action: "warn"; stage: InactivityStage; daysLeft: number; pauseAt: Date }
  | { action: "pause"; pauseAt: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

function sameInstant(a: Date | null, b: Date | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

/**
 * Что делать с организацией в этом прогоне.
 *
 * - Точка отсчёта — последняя запись, а если записей нет — создание.
 * - `pauseAt` = точка отсчёта + 100 дней. `daysLeft` — целых дней до
 *   неё (округление вверх: за 6.5 дней до паузы это «7 дней»).
 * - Предупреждаем на самой крупной стадии, которая уже наступила
 *   (`daysLeft <= stage`) и ещё не была отправлена ДЛЯ ЭТОЙ ЖЕ
 *   активности. Новая запись сдвигает точку отсчёта — прошлые письма
 *   перестают считаться, серия начинается заново.
 * - Если крон пропустил стадию (не запускался), уходит только текущая —
 *   без «догоняющих» писем.
 * - `daysLeft <= 0` → пауза.
 */
export function decideInactivity(input: InactivityInput): InactivityDecision {
  const anchor = input.lastActivityAt ?? input.createdAt;
  const pauseAt = new Date(anchor.getTime() + INACTIVITY_PAUSE_DAYS * DAY_MS);
  const daysLeft = Math.ceil((pauseAt.getTime() - input.now.getTime()) / DAY_MS);

  if (daysLeft <= 0) return { action: "pause", pauseAt };

  const alreadyWarnedForThisActivity =
    input.warnedStage !== null && sameInstant(input.warnedForActivityAt, input.lastActivityAt);
  const warnedStage = alreadyWarnedForThisActivity ? (input.warnedStage as number) : Infinity;

  // Текущая стадия — самая маленькая из наступивших (daysLeft <= s), и
  // она должна быть ниже уже отправленной. Стадии идут по убыванию,
  // поэтому берём последнюю подходящую.
  const reached = INACTIVITY_WARNING_STAGES.filter((s) => daysLeft <= s && s < warnedStage);
  const stage = reached[reached.length - 1];
  if (stage !== undefined) return { action: "warn", stage, daysLeft, pauseAt };

  return { action: "none", daysLeft, pauseAt };
}
