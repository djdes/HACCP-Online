import type { ReviewKind } from "./constants";

/**
 * Client-safe часть отзывов: типы и чистые функции.
 *
 * Отдельный файл, потому что `reviews.ts` тянет prisma (и через него —
 * `pg` с node-модулями), а карточка модерации и карусель на лендинге —
 * клиентские компоненты. Импорт значения оттуда роняет сборку на
 * `Can't resolve 'tls'`.
 */
export type ReviewStatus = "pending" | "approved" | "rejected";

export type ReviewView = {
  id: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  authorName: string;
  place: string;
  text: string;
  kind: ReviewKind;
  mediaUrl: string | null;
  mediaMime: string | null;
  rating: number | null;
  consentPublic: boolean;
  status: ReviewStatus;
  rewardRub: number;
  /** Сколько начислим, если одобрить как есть. */
  suggestedRewardRub: number;
  rejectReason: string | null;
  showOnLanding: boolean;
  createdAt: string;
  moderatedAt: string | null;
};

export type PublicReview = {
  id: string;
  quote: string;
  author: string;
  place: string;
  rating: number | null;
  mediaUrl: string | null;
  mediaKind: "photo" | "video" | null;
};

/** Текст для соцсетей — кнопка «Скопировать» в модерации. */
export function reviewSocialText(review: ReviewView): string {
  const lines = [
    `«${review.text}»`,
    "",
    `— ${review.authorName}, ${review.place}`,
  ];
  if (review.mediaUrl) lines.push("", review.mediaUrl);
  lines.push("", "wesetup.ru — электронные журналы СанПиН и ХАССП");
  return lines.join("\n");
}
