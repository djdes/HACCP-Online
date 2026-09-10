/**
 * SEO-здоровье публичных страниц: обход всех адресов из sitemap, разбор
 * заголовков и ссылок, список проблем. Чистые функции здесь; обход — в
 * `crawl.ts` (сеть), чтобы правила можно было тестировать без запросов.
 */
export type PageFacts = {
  url: string;
  status: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  h1Count: number;
  hasOgImage: boolean;
  hasJsonLd: boolean;
  internalLinks: string[];
  ms: number;
};

export type SeoIssue = { kind: "status" | "title" | "description" | "canonical" | "h1" | "og" | "duplicate-title" | "broken-link" | "slow"; url: string; detail: string };

const TITLE_MIN = 20;
const TITLE_MAX = 70;
const DESC_MIN = 60;
const DESC_MAX = 170;
const SLOW_MS = 3000;

export function extractFacts(url: string, status: number, html: string, ms: number): PageFacts {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  const metaContent = (name: string) =>
    html.match(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, "i"))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${name}"`, "i"))?.[1] ??
    null;
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i)?.[1] ?? html.match(/<link[^>]+href="([^"]*)"[^>]+rel="canonical"/i)?.[1] ?? null;
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  const links = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href="(\/[^"#?]*)/gi)) {
    const href = m[1];
    if (href.startsWith("/_next") || href.startsWith("/api/")) continue;
    links.add(href.replace(/\/+$/, "") || "/");
  }
  return {
    url,
    status,
    title,
    description: metaContent("description"),
    canonical,
    h1Count,
    hasOgImage: Boolean(metaContent("og:image")),
    hasJsonLd: html.includes('application/ld+json'),
    internalLinks: [...links],
    ms,
  };
}

export function findIssues(pages: PageFacts[], linkStatus: Record<string, number>): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const titles = new Map<string, string[]>();
  for (const p of pages) {
    if (p.status !== 200) {
      issues.push({ kind: "status", url: p.url, detail: `HTTP ${p.status}` });
      continue;
    }
    if (!p.title) issues.push({ kind: "title", url: p.url, detail: "нет <title>" });
    else {
      if (p.title.length < TITLE_MIN) issues.push({ kind: "title", url: p.url, detail: `title короткий (${p.title.length})` });
      if (p.title.length > TITLE_MAX) issues.push({ kind: "title", url: p.url, detail: `title длинный (${p.title.length})` });
      titles.set(p.title, [...(titles.get(p.title) ?? []), p.url]);
    }
    if (!p.description) issues.push({ kind: "description", url: p.url, detail: "нет meta description" });
    else if (p.description.length < DESC_MIN || p.description.length > DESC_MAX) {
      issues.push({ kind: "description", url: p.url, detail: `description ${p.description.length} симв. (норма ${DESC_MIN}–${DESC_MAX})` });
    }
    if (!p.canonical) issues.push({ kind: "canonical", url: p.url, detail: "нет canonical" });
    else if (p.canonical.replace(/\/+$/, "") !== p.url.replace(/\/+$/, "")) issues.push({ kind: "canonical", url: p.url, detail: `canonical → ${p.canonical}` });
    if (p.h1Count !== 1) issues.push({ kind: "h1", url: p.url, detail: `h1: ${p.h1Count}` });
    if (!p.hasOgImage) issues.push({ kind: "og", url: p.url, detail: "нет og:image" });
    if (p.ms > SLOW_MS) issues.push({ kind: "slow", url: p.url, detail: `${p.ms} мс` });
    for (const link of p.internalLinks) {
      const st = linkStatus[link];
      if (st !== undefined && st >= 400) issues.push({ kind: "broken-link", url: p.url, detail: `${link} → ${st}` });
    }
  }
  for (const [title, urls] of titles) {
    if (urls.length > 1) issues.push({ kind: "duplicate-title", url: urls[0], detail: `«${title}» ещё на: ${urls.slice(1).join(", ")}` });
  }
  return issues;
}
