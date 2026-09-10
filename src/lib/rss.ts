/** RSS 2.0 — чистая сборка ленты с экранированием. */
export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  guid?: string;
  categories?: string[];
};

export type RssChannel = {
  title: string;
  link: string;
  description: string;
  language?: string;
  selfUrl: string;
  items: RssItem[];
};

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function buildRss(channel: RssChannel): string {
  const items = [...channel.items]
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .map((item) =>
      [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="${item.guid ? "false" : "true"}">${escapeXml(item.guid ?? item.link)}</guid>`,
        `      <pubDate>${item.pubDate.toUTCString()}</pubDate>`,
        `      <description>${escapeXml(item.description)}</description>`,
        ...(item.categories ?? []).map((c) => `      <category>${escapeXml(c)}</category>`),
        "    </item>",
      ].join("\n")
    );
  const lastBuild = channel.items.length ? new Date(Math.max(...channel.items.map((i) => i.pubDate.getTime()))) : new Date();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${channel.language ?? "ru"}</language>`,
    `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
