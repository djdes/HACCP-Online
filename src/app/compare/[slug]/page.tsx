import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Minus } from "lucide-react";

import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { COMPARISONS, COMPARISON_ORDER } from "@/content/comparisons";
import { jsonLdSafeString } from "@/lib/json-ld";
import { DEFAULT_TWITTER_CARD } from "@/lib/meta-defaults";
import { ogImages, twitterImages } from "@/lib/og-image";

export const dynamic = "force-static";
const SITE = "https://wesetup.ru";

export function generateStaticParams() {
  return COMPARISON_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = COMPARISONS[slug];
  if (!c) return { title: { absolute: "Сравнение не найдено — WeSetup" } };
  const url = `${SITE}/compare/${c.slug}`;
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: url },
    openGraph: { type: "article", locale: "ru_RU", siteName: "WeSetup", url, title: c.metaTitle, description: c.metaDescription, images: ogImages({ title: c.title, subtitle: c.metaDescription, kind: "compare" }) },
    twitter: { card: DEFAULT_TWITTER_CARD, title: c.metaTitle, description: c.metaDescription, images: twitterImages({ title: c.title, kind: "compare" }) },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = COMPARISONS[slug];
  if (!c) notFound();
  const url = `${SITE}/compare/${c.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: c.metaTitle, description: c.metaDescription, url, mainEntityOfPage: url, inLanguage: "ru-RU", image: [ogImages({ title: c.title, kind: "compare" })[0].url], publisher: { "@type": "Organization", name: "WeSetup", url: SITE } },
      { "@type": "FAQPage", mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };
  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafeString(jsonLd) }} />
      <PublicHeader />
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-12">
        <PublicBreadcrumbs items={[{ name: "Сравнения", href: "/compare" }, { name: c.rival }]} tone="light" />
        <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[44px]">{c.title}</h1>
        <p className="mt-4 max-w-[760px] text-[16px] leading-[1.7] text-[#3c4053]">{c.intro}</p>

        <div className="mt-8 overflow-x-auto rounded-3xl border border-[#ececf4] shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-[#fafbff] text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
                <th className="px-5 py-3">Критерий</th>
                <th className="px-5 py-3">{c.rival}</th>
                <th className="px-5 py-3 text-[#3848c7]">WeSetup</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row) => (
                <tr key={row.criterion} className="border-t border-[#ececf4] align-top">
                  <td className="px-5 py-4 font-semibold">{row.criterion}</td>
                  <td className="px-5 py-4 text-[#3c4053]">
                    <span className="flex items-start gap-2"><Minus className="mt-1 size-4 shrink-0 text-[#9b9fb3]" />{row.rival}</span>
                  </td>
                  <td className="px-5 py-4 text-[#0b1024]">
                    <span className="flex items-start gap-2"><Check className="mt-1 size-4 shrink-0 text-[#116b2a]" />{row.wesetup}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 rounded-3xl border border-[#ececf4] bg-[#fafbff] p-6">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">Вывод</div>
          <p className="mt-2 text-[15px] leading-[1.7] text-[#0b1024]">{c.verdict}</p>
          <Link href="/register" className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]">
            Попробовать бесплатно
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <h2 className="mt-12 text-[24px] font-semibold tracking-[-0.02em]">Вопросы и ответы</h2>
        <div className="mt-4 space-y-3">
          {c.faq.map((f) => (
            <div key={f.q} className="rounded-2xl border border-[#ececf4] bg-white p-5">
              <div className="text-[15px] font-semibold">{f.q}</div>
              <p className="mt-1.5 text-[14px] leading-[1.65] text-[#3c4053]">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-2">
          {COMPARISON_ORDER.filter((s) => s !== c.slug).map((s) => (
            <Link key={s} href={`/compare/${s}`} className="rounded-full bg-[#f5f6ff] px-3.5 py-1.5 text-[13px] text-[#3848c7] hover:bg-[#eef1ff]">
              {COMPARISONS[s].title}
            </Link>
          ))}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
