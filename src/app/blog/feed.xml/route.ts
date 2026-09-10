import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildRss } from "@/lib/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RSS блога: опубликованные статьи, свежие первыми. */
export async function GET() {
  const articles = await db.article.findMany({
    where: { publishedAt: { not: null, lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: { slug: true, title: true, excerpt: true, publishedAt: true, tags: true },
  });
  const xml = buildRss({
    title: "WeSetup — блог о ХАССП и СанПиН",
    link: "https://wesetup.ru/blog",
    description: "Статьи о производственном контроле, журналах ХАССП и проверках Роспотребнадзора.",
    selfUrl: "https://wesetup.ru/blog/feed.xml",
    items: articles.map((a) => ({
      title: a.title,
      link: `https://wesetup.ru/blog/${a.slug}`,
      description: a.excerpt,
      pubDate: a.publishedAt ?? new Date(),
      categories: a.tags,
    })),
  });
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
