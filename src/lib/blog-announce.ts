import { db } from "@/lib/db";

/**
 * Автопост новой статьи в Telegram-канал. Работает только при заданном
 * `TELEGRAM_BLOG_CHANNEL_ID`; шлём один раз — когда статья впервые
 * становится опубликованной (`publishedAt` из null в дату не позже сейчас).
 */
export async function announceArticleIfPublished(input: {
  before: { publishedAt: Date | null };
  after: { slug: string; title: string; excerpt: string; publishedAt: Date | null };
}): Promise<boolean> {
  const channel = process.env.TELEGRAM_BLOG_CHANNEL_ID?.trim();
  if (!channel) return false;
  const wasPublic = Boolean(input.before.publishedAt && input.before.publishedAt <= new Date());
  const isPublic = Boolean(input.after.publishedAt && input.after.publishedAt <= new Date());
  if (wasPublic || !isPublic) return false;
  const { sendTelegramMessage, escapeTelegramHtml } = await import("@/lib/telegram");
  const text = [
    `📝 <b>${escapeTelegramHtml(input.after.title)}</b>`,
    "",
    escapeTelegramHtml(input.after.excerpt),
    "",
    `https://wesetup.ru/blog/${input.after.slug}`,
  ].join("\n");
  try {
    await sendTelegramMessage(channel, text);
    return true;
  } catch (error) {
    console.error("[blog-announce] failed", error);
    return false;
  }
}

/** Для маршрутов ROOT: состояние статьи до правки. */
export async function articlePublishState(id: string): Promise<{ publishedAt: Date | null } | null> {
  return db.article.findUnique({ where: { id }, select: { publishedAt: true } });
}
