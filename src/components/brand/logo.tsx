/**
 * Брендовые знаки WeSetup.
 *
 * Начертание — присланный файл `public/brand/wordmark.png` (белые
 * буквы на прозрачном фоне). Показываем его НЕ картинкой, а маской:
 * прозрачность PNG вырезает форму букв, а цвет даёт `currentColor`
 * родителя. Иначе пришлось бы держать два файла — белый для тёмных
 * шапок и тёмный для светлых — и вручную выбирать нужный в каждом из
 * девяти мест, где стоит знак. С маской он темнеет на лендинге,
 * белеет на экране входа и подхватывается тёмной темой кабинета сам.
 *
 * Ширина считается от высоты по пропорции файла.
 */
const WORDMARK_SRC = "/brand/wordmark.png";
/**
 * Файл обрезан по фактическим границам букв (631×143). В исходнике
 * сверху было 52px пустоты, снизу 45 — маска центрировала коробку, а
 * не сам знак, и он вставал выше оптического центра строки.
 */
const WORDMARK_RATIO = 631 / 143;

export function BrandLogo({
  height = 22,
  className,
  title = "WeSetup",
}: {
  /** Высота знака в px. */
  height?: number;
  className?: string;
  /** Пустая строка — знак декоративный, читалка его пропустит. */
  title?: string;
}) {
  return (
    <span
      role={title ? "img" : "presentation"}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{
        // block, а не inline-block: у строчного элемента бокс садится
        // на базовую линию, и знак вставал выше центра строки.
        display: "block",
        height,
        width: height * WORDMARK_RATIO,
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${WORDMARK_SRC})`,
        maskImage: `url(${WORDMARK_SRC})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

/**
 * Иконка приложения — растровая: в ней объём и цветная подложка,
 * которые в маску не переносятся. Тот же файл лежит в PWA-иконках и
 * в фавиконе.
 */
export function BrandMark({
  size = 32,
  className,
  title = "WeSetup",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/icon-64.png"
      width={size}
      height={size}
      alt={title}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
