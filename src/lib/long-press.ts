/**
 * Распознавание долгого нажатия.
 *
 * Смысл жеста — короткий путь к тому, ради чего человек и открыл
 * список: из главной в «заполнить как вчера» сейчас три касания и два
 * перехода, а удержанием это одно движение.
 *
 * Чистой функцией — потому что весь жест держится на двух порогах, и
 * оба ошибаются тихо. Слишком щедрый допуск по сдвигу — и прокрутка
 * списка открывает меню у случайной карточки; слишком строгий — и
 * жест не срабатывает у человека, который просто не держит палец
 * идеально неподвижно.
 */

export type PressPoint = { x: number; y: number };

/** 500 мс — привычная граница: короче путается с обычным тапом. */
export const LONG_PRESS_MS = 500;

/**
 * Допуск на дрожание пальца. Палец, ведущий список, за это время
 * уходит заметно дальше — так жест и отличается от прокрутки.
 */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/** Сдвинулся дальше допуска — это была прокрутка, а не удержание. */
export function isLongPressCancelled(
  start: PressPoint,
  current: PressPoint,
  tolerancePx: number = LONG_PRESS_MOVE_TOLERANCE_PX
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > tolerancePx;
}

/**
 * Доля до срабатывания, от 0 до 1 — по ней рисуется медленное
 * проседание карточки. Без видимой обратной связи удержание ощущается
 * как зависание, и человек отпускает раньше времени.
 */
export function longPressProgress(
  elapsedMs: number,
  durationMs: number = LONG_PRESS_MS
): number {
  if (durationMs <= 0) return 1;
  return Math.min(1, Math.max(0, elapsedMs / durationMs));
}
