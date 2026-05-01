/**
 * Дефолтная картинка для og:image / twitter:image.
 *
 * Next.js делает shallow-merge для metadata.openGraph и metadata.twitter:
 * если page-level задаёт openGraph: {...}, layout-level openGraph
 * ПОЛНОСТЬЮ заменяется. Поэтому простого `images` в layout.tsx
 * недостаточно — каждая страница, которая сама задаёт `openGraph` или
 * `twitter`, должна включить эти `images` в свой блок.
 *
 * Этот helper — единственное место, где живёт URL картинки.
 *
 * 2026-05-01 (R35): раньше был 512×512 квадрат + twitter:card=summary.
 * Соцсети крашили этот квадрат, Telegram показывал серый плейсхолдер.
 * Теперь brand 1200×630 (рекомендованный Facebook/LinkedIn размер) +
 * summary_large_image. Картинка генерируется на edge через next/og в
 * src/app/og-default/route.tsx и кэшируется immutable forever.
 */
const OG_IMAGE_URL = "https://wesetup.ru/og-default";

export const DEFAULT_OG_IMAGES = [
  {
    url: OG_IMAGE_URL,
    width: 1200,
    height: 630,
    alt: "WeSetup — электронные журналы СанПиН и ХАССП",
  },
] as const;

export const DEFAULT_TWITTER_IMAGES = [OG_IMAGE_URL] as const;

/**
 * Card type — `summary_large_image` (2:1 hero). Требует ≥600px-широкую
 * картинку, что у нас 1200×630 покрывает с запасом. Превью в Twitter,
 * Telegram, FB теперь занимает всю ширину карточки.
 */
export const DEFAULT_TWITTER_CARD = "summary_large_image" as const;
