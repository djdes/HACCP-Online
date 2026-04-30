import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { JOURNAL_INFO } from "@/content/journal-info";
import { FEATURES_ORDER } from "@/content/features";
import { NICHES } from "@/components/landing/niche-landing";
import { SEO_LANDINGS } from "@/components/landing/seo-journal-landing";

/**
 * Dynamic sitemap for crawlers. Combines:
 * - Static public pages (landing, blog list, journals-info list)
 * - All 34 /journals-info/[code] entries
 * - 8 /features/[slug] entries
 * - Every published blog article
 *
 * Rebuilt on each request because `dynamic = "force-dynamic"` is set
 * across the app — sitemap would otherwise cache stale article lists.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = "https://wesetup.ru";
const now = new Date();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await db.article
    .findMany({
      where: { publishedAt: { not: null } },
      select: { slug: true, publishedAt: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    })
    .catch(() => []);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/journals-info`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    // /pricing — высоко-конверсионная страница (ROI калькулятор + тарифы),
    // высокий приоритет для индексации. Раньше отсутствовала в sitemap'е.
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  const journalPages: MetadataRoute.Sitemap = Object.keys(JOURNAL_INFO).map(
    (code) => ({
      url: `${SITE}/journals-info/${code}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    })
  );

  const featurePages: MetadataRoute.Sitemap = FEATURES_ORDER.map((slug) => ({
    url: `${SITE}/features/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.65,
  }));

  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE}/blog/${a.slug}`,
    lastModified: a.updatedAt ?? a.publishedAt ?? now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // E19 — niche-лендинги (/dlya-kafe и т.д.)
  const nichePages: MetadataRoute.Sitemap = Object.keys(NICHES).map((slug) => ({
    url: `${SITE}/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.85,
  }));

  // E17 — SEO-лендинги под ключевые запросы (журнал ХАССП и т.д.)
  const seoPages: MetadataRoute.Sitemap = Object.keys(SEO_LANDINGS).map(
    (slug) => ({
      url: `${SITE}/${slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    }),
  );

  return [
    ...staticPages,
    ...journalPages,
    ...featurePages,
    ...articlePages,
    ...nichePages,
    ...seoPages,
  ];
}
