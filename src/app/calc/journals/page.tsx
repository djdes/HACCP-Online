import type { Metadata } from "next";

import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { JOURNAL_INFO } from "@/content/journal-info";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { DEFAULT_TWITTER_CARD } from "@/lib/meta-defaults";
import { ogImages, twitterImages } from "@/lib/og-image";

import { JournalsCalculator } from "./journals-calculator";

const TITLE = "Какие журналы нужны моему заведению";
const DESCRIPTION = "Калькулятор обязательных журналов СанПиН и ХАССП: выберите тип заведения и особенности — получите список журналов со ссылками на формы.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://wesetup.ru/calc/journals" },
  openGraph: { type: "website", locale: "ru_RU", siteName: "WeSetup", url: "https://wesetup.ru/calc/journals", title: TITLE, description: DESCRIPTION, images: ogImages({ title: TITLE, subtitle: DESCRIPTION, kind: "calc" }) },
  twitter: { card: DEFAULT_TWITTER_CARD, title: TITLE, description: DESCRIPTION, images: twitterImages({ title: TITLE, kind: "calc" }) },
};

export default function JournalsCalcPage() {
  const names: Record<string, string> = {};
  for (const j of ACTIVE_JOURNAL_CATALOG) names[j.code] = j.name;
  for (const code of Object.keys(JOURNAL_INFO)) if (!names[code]) names[code] = JOURNAL_INFO[code].tagline;
  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <PublicHeader />
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-12">
        <PublicBreadcrumbs items={[{ name: "Калькуляторы", href: "/calc/journals" }, { name: "Какие журналы нужны" }]} tone="light" />
        <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[44px]">{TITLE}</h1>
        <p className="mt-3 max-w-[720px] text-[16px] leading-[1.7] text-[#3c4053]">{DESCRIPTION} Список ориентировочный: точный состав закрепляется в программе производственного контроля.</p>
        <JournalsCalculator names={names} />
      </div>
      <PublicFooter />
    </div>
  );
}
