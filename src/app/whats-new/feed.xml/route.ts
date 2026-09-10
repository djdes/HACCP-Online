import { NextResponse } from "next/server";

import { CHANGELOG } from "@/content/changelog";
import { buildRss } from "@/lib/rss";

export const dynamic = "force-static";
export const revalidate = 3600;

/** RSS истории изменений. */
export function GET() {
  const xml = buildRss({
    title: "WeSetup — что нового",
    link: "https://wesetup.ru/whats-new",
    description: "История изменений электронных журналов СанПиН и ХАССП.",
    selfUrl: "https://wesetup.ru/whats-new/feed.xml",
    items: CHANGELOG.map((entry) => ({
      title: entry.title,
      link: `https://wesetup.ru/whats-new#${entry.slug}`,
      guid: `wesetup-changelog-${entry.slug}`,
      description: entry.items.join(" "),
      pubDate: new Date(`${entry.date}T09:00:00+03:00`),
    })),
  });
  return new NextResponse(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
