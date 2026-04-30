/**
 * Дефолтная картинка для og:image / twitter:image.
 *
 * Next.js делает shallow-merge для metadata.openGraph и metadata.twitter:
 * если page-level задаёт openGraph: {...}, layout-level openGraph
 * ПОЛНОСТЬЮ заменяется. Поэтому простого `images` в layout.tsx
 * недостаточно — каждая страница, которая сама задаёт `openGraph` или
 * `twitter`, должна включить эти `images` в свой блок.
 *
 * Этот helper — единственное место, где живёт URL картинки. Когда
 * появится designed 1200×630 hero-image для соцсетей, поменяем здесь.
 */
const LOGO_URL = "https://wesetup.ru/icons/icon-512.png";

export const DEFAULT_OG_IMAGES = [
  {
    url: LOGO_URL,
    width: 512,
    height: 512,
    alt: "WeSetup — электронные журналы СанПиН и ХАССП",
  },
] as const;

export const DEFAULT_TWITTER_IMAGES = [LOGO_URL] as const;

/**
 * Card type должен быть `summary` (square) пока у нас квадратный logo.
 * `summary_large_image` требует 2:1 hero-image, и без неё Twitter
 * молча downgrade'ит карту до пустой.
 */
export const DEFAULT_TWITTER_CARD = "summary" as const;
