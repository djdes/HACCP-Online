import type { Metadata } from "next";
import Link from "next/link";

import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { GLOSSARY } from "@/content/glossary";
import { jsonLdSafeString } from "@/lib/json-ld";
import { DEFAULT_TWITTER_CARD } from "@/lib/meta-defaults";
import { ogImages, twitterImages } from "@/lib/og-image";

const TITLE = "Глоссарий ХАССП и СанПиН";
const DESCRIPTION = `${GLOSSARY.length} терминов производственного контроля простыми словами: ККТ, бракераж, ППК, медкнижки, «Меркурий», статьи КоАП — с ссылками на журналы.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://wesetup.ru/glossary" },
  openGraph: { type: "website", locale: "ru_RU", siteName: "WeSetup", url: "https://wesetup.ru/glossary", title: TITLE, description: DESCRIPTION, images: ogImages({ title: TITLE, subtitle: DESCRIPTION, kind: "glossary" }) },
  twitter: { card: DEFAULT_TWITTER_CARD, title: TITLE, description: DESCRIPTION, images: twitterImages({ title: TITLE, kind: "glossary" }) },
};

export default function GlossaryIndexPage() {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "ru"));
  const groups = new Map<string, typeof sorted>();
  for (const t of sorted) {
    const letter = t.term[0].toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), t]);
  }
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: TITLE,
    url: "https://wesetup.ru/glossary",
    hasDefinedTerm: sorted.map((t) => ({ "@type": "DefinedTerm", name: t.term, description: t.short, url: `https://wesetup.ru/glossary/${t.slug}` })),
  };
  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSafeString(jsonLd) }} />
      <PublicHeader />
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-12">
        <PublicBreadcrumbs items={[{ name: "Глоссарий" }]} tone="light" />
        <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[44px]">{TITLE}</h1>
        <p className="mt-3 max-w-[720px] text-[16px] leading-[1.7] text-[#3c4053]">{DESCRIPTION}</p>
        <div className="mt-6 flex flex-wrap gap-1.5">
          {[...groups.keys()].map((letter) => (
            <a key={letter} href={`#${letter}`} className="rounded-full bg-[#f5f6ff] px-3 py-1 text-[13px] font-medium text-[#3848c7] hover:bg-[#eef1ff]">
              {letter}
            </a>
          ))}
        </div>
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([letter, terms]) => (
            <section key={letter} id={letter}>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">{letter}</div>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {terms.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/glossary/${t.slug}`} className="block h-full rounded-2xl border border-[#ececf4] bg-white p-4 transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]">
                      <div className="text-[15px] font-semibold">{t.term}</div>
                      <p className="mt-1 text-[13px] leading-[1.55] text-[#3c4053]">{t.short}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
