/**
 * Распознавание свайпа по строке журнала.
 *
 * Вынесено чистой функцией и под тест намеренно: этот жест ставит
 * значение в журнал, а журнал — доказательство на проверке. Случайное
 * движение в кармане не должно подписать смену, и проверить это надо
 * логикой, а не «покрутил на телефоне, вроде не срабатывает».
 *
 * Три условия, каждое закрывает свою беду:
 *
 *   • мёртвая зона у левого края — там системный жест «назад» на iOS,
 *     и перехватывать его нельзя: человек уйдёт со страницы вместо
 *     отметки;
 *   • порог по расстоянию — случайное касание при прокрутке короче;
 *   • порог по углу — палец, ведущий список вверх, уходит вбок на
 *     десяток пикселей, и без угла это читалось бы как свайп.
 */

export type SwipePoint = { x: number; y: number };

export type SwipeConfig = {
  /** Ширина мёртвой зоны у левого края экрана. */
  edgeGuardPx: number;
  /** Сколько надо протащить по горизонтали, чтобы жест засчитался. */
  thresholdPx: number;
  /** Максимальное отклонение от горизонтали в градусах. */
  maxAngleDeg: number;
};

export const DEFAULT_SWIPE_CONFIG: SwipeConfig = {
  // Системная зона «назад» на iOS — около 20 px; берём с запасом.
  edgeGuardPx: 28,
  // 72 px — заметно больше дрожания руки и случайного сдвига при
  // прокрутке, но всё ещё одно спокойное движение большим пальцем.
  thresholdPx: 72,
  // 30° даёт уверенно горизонтальное движение и не мешает прокрутке.
  maxAngleDeg: 30,
};

export type SwipeDecision =
  /** Ещё ничего не решено — жест продолжается. */
  | { kind: "pending" }
  /** Движение вертикальное: это прокрутка списка, не мешаем. */
  | { kind: "scroll" }
  | { kind: "right" }
  | { kind: "left" };

/**
 * Начинать ли отслеживание. Отказ у левого края — единственная причина
 * не начинать: перехват системного «назад» хуже любой потери удобства.
 */
export function canStartSwipe(
  start: SwipePoint,
  config: SwipeConfig = DEFAULT_SWIPE_CONFIG,
): boolean {
  return start.x > config.edgeGuardPx;
}

export function decideSwipe(
  start: SwipePoint,
  current: SwipePoint,
  config: SwipeConfig = DEFAULT_SWIPE_CONFIG,
): SwipeDecision {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  // Вертикаль решаем раньше порога: иначе быстрый скролл, слегка
  // ушедший вбок, успел бы дотянуть до порога и поставить значение.
  if (absY > absX) return { kind: "scroll" };

  if (absX < config.thresholdPx) return { kind: "pending" };

  const angleDeg = (Math.atan2(absY, absX) * 180) / Math.PI;
  if (angleDeg > config.maxAngleDeg) return { kind: "scroll" };

  return dx > 0 ? { kind: "right" } : { kind: "left" };
}

/**
 * Насколько сдвинуть строку под пальцем. Ограничиваем и подтормаживаем
 * за порогом: строка не должна уезжать за экран, а сопротивление
 * подсказывает, что дальше тянуть незачем.
 */
export function swipeOffset(
  dx: number,
  config: SwipeConfig = DEFAULT_SWIPE_CONFIG,
): number {
  const max = config.thresholdPx;
  if (Math.abs(dx) <= max) return dx;
  const overshoot = Math.abs(dx) - max;
  // Корень даёт затухание: первые пиксели за порогом ещё видны,
  // дальше строка почти стоит.
  const damped = max + Math.sqrt(overshoot) * 4;
  return dx > 0 ? damped : -damped;
}
