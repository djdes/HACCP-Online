import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { COMPARISONS, COMPARISON_ORDER } from "@/content/comparisons";
import { DEFAULT_TWITTER_CARD } from "@/lib/meta-defaults";
import { ogImages, twitterImages } from "@/lib/og-image";

const TITLE = "Сравнения: WeSetup против бумаги, Excel и 1С";
const DESCRIPTION = "Как электронные журналы ХАССП соотносятся с бумажными тетрадями, таблицами и учётными системами — по пунктам, без маркетинга.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://wesetup.ru/compare" },
  openGraph: { type: "website", locale: "ru_RU", siteName: "WeSetup", url: "https://wesetup.ru/compare", title: TITLE, description: DESCRIPTION, images: ogImages({ title: TITLE, subtitle: DESCRIPTION, kind: "compare" }) },
  twitter: { card: DEFAULT_TWITTER_CARD, title: TITLE, description: DESCRIPTION, images: twitterImages({ title: TITLE, kind: "compare" }) },
};

export default function CompareIndexPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <PublicHeader />
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-12">
        <PublicBreadcrumbs items={[{ name: "Сравнения" }]} tone="light" />
        <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[44px]">Сравнения</h1>
        <p className="mt-3 max-w-[720px] text-[16px] leading-[1.7] text-[#3c4053]">{DESCRIPTION}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {COMPARISON_ORDER.map((slug) => {
            const c = COMPARISONS[slug];
            return (
              <Link key={slug} href={`/compare/${slug}`} className="group rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:border-[#5566f6]/40 hover:shadow-[0_16px_40px_-24px_rgba(85,102,246,0.35)]">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">против</div>
                <div className="mt-1 text-[20px] font-semibold tracking-[-0.01em]">{c.rival}</div>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#3c4053]">{c.intro.slice(0, 140)}…</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#3848c7]">
                  Читать
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
