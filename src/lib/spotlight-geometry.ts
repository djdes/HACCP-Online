/**
 * Чистая геометрия спотлайт-тура: вырез вокруг элемента, SVG-path с
 * дыркой и размещение карточки шага. Без DOM, чтобы проверять юнит-тестами
 * и не гадать в браузере, куда уедет карточка.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

export const HOLE_PADDING = 6;
export const HOLE_RADIUS = 12;
export const CARD_MARGIN = 12;
export const CARD_GAP = 10;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Прямоугольник выреза: цель + отступ со всех сторон. */
export function holeRect(target: Rect, padding = HOLE_PADDING): Rect {
  return {
    x: target.x - padding,
    y: target.y - padding,
    width: target.width + padding * 2,
    height: target.height + padding * 2,
  };
}

/**
 * Path для `<path fill-rule="evenodd">`: внешний прямоугольник viewport
 * плюс скруглённый прямоугольник выреза. Evenodd оставляет дырку
 * непрокрашенной.
 */
export function cutoutPath(viewport: Size, hole: Rect, radius = HOLE_RADIUS): string {
  const r = Math.max(0, Math.min(radius, hole.width / 2, hole.height / 2));
  const w = hole.width - 2 * r;
  const h = hole.height - 2 * r;
  const outer = `M0 0H${fmt(viewport.width)}V${fmt(viewport.height)}H0Z`;
  const inner =
    `M${fmt(hole.x + r)} ${fmt(hole.y)}` +
    `h${fmt(w)}a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r)} ${fmt(r)}` +
    `v${fmt(h)}a${fmt(r)} ${fmt(r)} 0 0 1 -${fmt(r)} ${fmt(r)}` +
    `h-${fmt(w)}a${fmt(r)} ${fmt(r)} 0 0 1 -${fmt(r)} -${fmt(r)}` +
    `v-${fmt(h)}a${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(r)} -${fmt(r)}z`;
  return `${outer} ${inner}`;
}

export type CardPlacement = { top: number; left: number; side: "below" | "above" };

/**
 * Карточка шага: под целью, если помещается (или места снизу больше, чем
 * сверху), иначе над ней; по горизонтали — по центру цели с clamp в
 * viewport. Если цель выше экрана — карточка прижимается к нижнему краю.
 */
export function placeCard({
  viewport,
  hole,
  card,
  margin = CARD_MARGIN,
  gap = CARD_GAP,
}: {
  viewport: Size;
  hole: Rect;
  card: Size;
  margin?: number;
  gap?: number;
}): CardPlacement {
  const spaceBelow = viewport.height - (hole.y + hole.height) - margin;
  const spaceAbove = hole.y - margin;
  const below = spaceBelow >= card.height + gap || spaceBelow >= spaceAbove;
  const rawTop = below ? hole.y + hole.height + gap : hole.y - gap - card.height;
  const top = clamp(rawTop, margin, viewport.height - margin - card.height);
  const left = clamp(
    hole.x + hole.width / 2 - card.width / 2,
    margin,
    viewport.width - margin - card.width,
  );
  return { top, left, side: below ? "below" : "above" };
}
