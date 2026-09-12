/**
 * Жест «назад» от левого края.
 *
 * В Telegram у Mini App нет системного «назад»: браузерный жест Safari
 * до приложения не доходит, а кнопка `BackButton` живёт в шапке
 * Telegram — до неё надо тянуться через весь экран. Человек, привыкший
 * к телефону, тянет от края и не получает ничего.
 *
 * Экран разделён с {@link canStartSwipe} по построению: свайп строки
 * журнала начинается только правее `edgeGuardPx`, этот жест — только
 * левее. Одна и та же константа, поэтому перепутать их нельзя и
 * одновременно сработать они не могут.
 *
 * Чистой функцией и под тестом — потому что ошибка тут уводит с
 * экрана, где человек только что что-то заполнял, а причину он не
 * увидит: для него это «приложение само закрылось».
 */

import { DEFAULT_SWIPE_CONFIG, type SwipePoint } from "./swipe-gesture";

export type EdgeBackConfig = {
  /** Ширина зоны у левого края, в которой жест вообще начинается. */
  edgeGuardPx: number;
  /** Доля ширины экрана, после которой отпускание означает «назад». */
  commitRatio: number;
  /** Нижняя граница для узких экранов. */
  minCommitPx: number;
  /** Максимальное отклонение от горизонтали в градусах. */
  maxAngleDeg: number;
  /** Скорость, при которой короткий рывок тоже засчитывается (px/мс). */
  flingVelocity: number;
};

export const DEFAULT_EDGE_BACK_CONFIG: EdgeBackConfig = {
  // Та же зона, что у свайпа строки, — они делят экран без зазора.
  edgeGuardPx: DEFAULT_SWIPE_CONFIG.edgeGuardPx,
  // Четверть экрана — привычная граница: меньше похоже на случайное
  // задевание края, больше требует перехвата пальцем.
  commitRatio: 0.25,
  minCommitPx: 64,
  // Строже, чем у свайпа строки: здесь цена ошибки — уход с экрана.
  maxAngleDeg: 25,
  flingVelocity: 0.5,
};

/** Жест начинается только у самого края — там, где свайп строки не работает. */
export function canStartEdgeBack(
  start: SwipePoint,
  config: EdgeBackConfig = DEFAULT_EDGE_BACK_CONFIG
): boolean {
  return start.x >= 0 && start.x <= config.edgeGuardPx;
}

/** Расстояние, после которого отпускание означает «назад». */
export function commitDistance(
  viewportWidth: number,
  config: EdgeBackConfig = DEFAULT_EDGE_BACK_CONFIG
): number {
  return Math.max(config.minCommitPx, viewportWidth * config.commitRatio);
}

export type EdgeBackMove =
  /** Жест продолжается, экран можно сдвигать за пальцем. */
  | { kind: "pending"; progress: number }
  /** Это была прокрутка или движение влево — жест снят. */
  | { kind: "cancel" };

/**
 * Что происходит прямо сейчас, пока палец на экране.
 *
 * `progress` — от 0 до 1, доля до порога: по нему рисуется подсказка,
 * чтобы человек видел, сколько осталось дотянуть, а не гадал.
 */
export function trackEdgeBack(
  start: SwipePoint,
  current: SwipePoint,
  viewportWidth: number,
  config: EdgeBackConfig = DEFAULT_EDGE_BACK_CONFIG
): EdgeBackMove {
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  // Влево от края — это не «назад» ни в каком виде.
  if (dx <= 0) return { kind: "cancel" };

  const absY = Math.abs(dy);
  // Вертикаль решаем раньше угла: быстрый скролл, начатый у края,
  // иначе успевал бы набрать горизонталь и увести со страницы.
  if (absY > dx) return { kind: "cancel" };

  const angleDeg = (Math.atan2(absY, dx) * 180) / Math.PI;
  if (angleDeg > config.maxAngleDeg) return { kind: "cancel" };

  const progress = Math.min(1, dx / commitDistance(viewportWidth, config));
  return { kind: "pending", progress };
}

/**
 * Уходить ли назад после отпускания.
 *
 * Короткий быстрый рывок засчитывается наравне с медленным
 * протягиванием: так жест ощущается на телефоне, и без этого он
 * кажется «тугим».
 */
export function shouldCommitEdgeBack(
  progress: number,
  velocityPxPerMs: number,
  config: EdgeBackConfig = DEFAULT_EDGE_BACK_CONFIG
): boolean {
  if (progress >= 1) return true;
  // Рывок из ничего не считается: иначе задевание края ладонью уводит
  // с экрана. Нужен и рывок, и хоть какое-то пройденное расстояние.
  return velocityPxPerMs >= config.flingVelocity && progress >= 0.35;
}
