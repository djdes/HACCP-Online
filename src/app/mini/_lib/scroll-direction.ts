/**
 * Прятать ли главное действие при прокрутке.
 *
 * Кнопка «Новая запись» прижата к низу и закрывает две последние строки
 * списка. Пока человек читает — она мешает; как только он собрался
 * действовать (повёл список вверх, то есть к началу) — должна быть на
 * месте.
 *
 * Вынесено чистой функцией из-за одного конкретного врага: инерционного
 * скролла iOS. Он выдаёт события пачками с дрожанием в один-два пикселя
 * и «отскок» за границы списка с отрицательной координатой. Наивное
 * `y > lastY ? hide : show` на этом мигает кнопкой десятки раз в
 * секунду, и проверить такое руками на глаз невозможно.
 */

export type ScrollHideState = {
  /** Координата, от которой считаем следующий шаг. */
  lastY: number;
  hidden: boolean;
};

/**
 * Пока список почти в начале — кнопка видна всегда. Иначе она исчезает
 * от первого же короткого движения, ещё до того как что-то скрылось.
 */
export const SCROLL_HIDE_AFTER_PX = 72;

/** Меньший сдвиг считаем дрожанием, а не намерением. */
export const SCROLL_HYSTERESIS_PX = 12;

export const INITIAL_SCROLL_HIDE_STATE: ScrollHideState = {
  lastY: 0,
  hidden: false,
};

export function nextScrollHideState(
  prev: ScrollHideState,
  rawY: number
): ScrollHideState {
  // Отскок сверху даёт отрицательные значения — это всё ещё начало списка.
  const y = Math.max(0, rawY);

  if (y <= SCROLL_HIDE_AFTER_PX) {
    return prev.hidden || prev.lastY !== y ? { lastY: y, hidden: false } : prev;
  }

  const delta = y - prev.lastY;
  // Копим мелкие шаги: `lastY` не двигаем, пока не набралось намерение.
  if (Math.abs(delta) < SCROLL_HYSTERESIS_PX) return prev;

  const hidden = delta > 0;
  if (hidden === prev.hidden) return { lastY: y, hidden };
  return { lastY: y, hidden };
}
