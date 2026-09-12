/**
 * Приближение фотографии в лайтбоксе.
 *
 * Фото в журнале — доказательство: дата на упаковке, номер партии,
 * показание термометра. Открытое во весь экран телефона, оно всё равно
 * мельче, чем нужно, чтобы это прочитать, а жестов в лайтбоксе не было
 * вовсе — ни щипка, ни двойного касания.
 *
 * Вынесено чистой функцией из-за одного свойства, которое на глаз не
 * проверяется: точка между пальцами обязана оставаться на месте. Если
 * она уезжает, изображение «убегает» из-под щипка, и человек ловит
 * нужный угол фотографии наугад.
 */

export type ZoomPoint = { x: number; y: number };

export type ZoomState = {
  scale: number;
  /** Сдвиг в пикселях экрана от центрированного положения. */
  x: number;
  y: number;
};

export type Size = { width: number; height: number };

export const ZOOM_IDENTITY: ZoomState = { scale: 1, x: 0, y: 0 };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
/** Куда прыгает двойное касание: читать текст на упаковке этого хватает. */
export const DOUBLE_TAP_ZOOM = 2.5;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export function distance(a: ZoomPoint, b: ZoomPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: ZoomPoint, b: ZoomPoint): ZoomPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Изменить масштаб так, чтобы точка `focal` осталась под пальцами.
 *
 * `focal` — в координатах ОТ ЦЕНТРА области просмотра, в тех же, что
 * и сдвиг: так формула не зависит от размера экрана.
 */
export function zoomAround(
  state: ZoomState,
  focal: ZoomPoint,
  nextScale: number
): ZoomState {
  const scale = clampScale(nextScale);
  // Доля, на которую надо подтянуть сдвиг, чтобы точка не сдвинулась.
  const k = 1 - scale / state.scale;
  return {
    scale,
    x: state.x + (focal.x - state.x) * k,
    y: state.y + (focal.y - state.y) * k,
  };
}

/**
 * Не дать утащить изображение за край.
 *
 * Пока увеличенная картинка уже области просмотра по какой-то оси,
 * по этой оси она остаётся по центру: иначе фото уезжает в угол и
 * человек видит пустоту.
 */
export function clampPan(
  state: ZoomState,
  viewport: Size,
  content: Size
): ZoomState {
  const maxX = Math.max(0, (content.width * state.scale - viewport.width) / 2);
  const maxY = Math.max(0, (content.height * state.scale - viewport.height) / 2);
  return {
    scale: state.scale,
    x: Math.min(maxX, Math.max(-maxX, state.x)),
    y: Math.min(maxY, Math.max(-maxY, state.y)),
  };
}

/** Двойное касание переключает «как было» ↔ «приближено». */
export function nextDoubleTapState(
  state: ZoomState,
  focal: ZoomPoint
): ZoomState {
  if (isZoomed(state)) return ZOOM_IDENTITY;
  return zoomAround(state, focal, DOUBLE_TAP_ZOOM);
}

export function isZoomed(state: ZoomState): boolean {
  // С запасом на накопленную погрешность умножений: ровной единицы
  // после нескольких щипков не бывает.
  return state.scale > MIN_ZOOM + 0.01;
}
