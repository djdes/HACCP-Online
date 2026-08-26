/**
 * Брендовые знаки WeSetup.
 *
 * Wordmark нарисован вручную: монолинейная геометрия — все буквы
 * собраны из окружностей и прямых одной толщины с круглыми торцами.
 * Своя рисовка, а не шрифт: логотип не должен зависеть от того,
 * подгрузился ли веб-шрифт, и должен одинаково выглядеть в письме,
 * в OG-картинке и на печати.
 *
 * Оба знака рисуются `currentColor`, поэтому цвет задаёт родитель —
 * тёмный на светлой шапке, белый на тёмной, индиго в акцентных местах.
 * Никаких `fill`-заливок: только штрих, чтобы толщина не «плыла»
 * при масштабировании.
 *
 * Геометрия (юниты viewBox): x-height 0..100, выносной элемент «t»
 * вверх до −34, хвост «p» вниз до 148. Высота коробки 216 юнитов, из
 * них на строчные приходится 100 — поэтому визуально знак примерно
 * вдвое ниже заданного `height`.
 */

/** Полное начертание «wesetup». */
const WORDMARK_VIEWBOX = "-14 -48 696 216";

const WORDMARK_PATHS = [
  // w
  "M 0 0 L 18 100 L 42 22 L 66 100 L 84 0",
  // e
  "M 167 78 C 160 84 151 88 142 88 C 121 88 104 71 104 50 C 104 29 121 12 142 12 C 163 12 180 29 180 50 L 104 50",
  // s
  "M 272 24 C 272 6 208 4 208 30 C 208 50 272 52 272 74 C 272 98 208 96 208 78",
  // e
  "M 363 78 C 356 84 347 88 338 88 C 317 88 300 71 300 50 C 300 29 317 12 338 12 C 359 12 376 29 376 50 L 300 50",
  // t
  "M 426 -34 L 426 74 C 426 94 438 100 452 96 M 404 4 L 454 4",
  // u
  "M 486 0 L 486 60 C 486 84 503 100 524 100 C 545 100 562 84 562 60 L 562 0",
  // p — стойка и чаша
  "M 592 0 L 592 148",
  "M 592 50 C 592 29 609 12 630 12 C 651 12 668 29 668 50 C 668 71 651 88 630 88 C 609 88 592 71 592 50",
];

/** Монограмма — «w» из того же построения, для фавикона и плитки PWA. */
const MARK_VIEWBOX = "0 0 200 200";
const MARK_PATH = "M 0 0 L 18 100 L 42 22 L 66 100 L 84 0";

export function BrandLogo({
  height = 34,
  className,
  title = "WeSetup",
}: {
  /** Высота коробки в px, включая выносные элементы. 34 ≈ 16px строчных. */
  height?: number;
  className?: string;
  /** Пустая строка — знак декоративный, читалка его пропустит. */
  title?: string;
}) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      height={height}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ height, width: "auto" }}
      fill="none"
      stroke="currentColor"
      strokeWidth={20}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {WORDMARK_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function BrandMark({
  size = 32,
  className,
  /** Цвет плитки. `null` — без подложки, только знак. */
  background = "#5566f6",
  title = "WeSetup",
}: {
  size?: number;
  className?: string;
  background?: string | null;
  title?: string;
}) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      {background ? (
        <rect width="200" height="200" rx="48" fill={background} />
      ) : null}
      <g
        transform="translate(47 38) scale(1.25)"
        fill="none"
        stroke="currentColor"
        strokeWidth={24}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={MARK_PATH} />
      </g>
    </svg>
  );
}
