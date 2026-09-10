import type { Metadata } from "next";

import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { DEFAULT_TWITTER_CARD } from "@/lib/meta-defaults";
import { ogImages, twitterImages } from "@/lib/og-image";

import { FinesCalculator } from "./fines-calculator";

const TITLE = "Калькулятор штрафов Роспотребнадзора для общепита";
const DESCRIPTION = "Калькулятор штрафов Роспотребнадзора для общепита: статьи 6.3, 6.6 и 14.43 КоАП с суммами для ИП, юрлиц и должностных лиц. Отметьте нарушения и увидите диапазон.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://wesetup.ru/calc/fines" },
  openGraph: { type: "website", locale: "ru_RU", siteName: "WeSetup", url: "https://wesetup.ru/calc/fines", title: TITLE, description: DESCRIPTION, images: ogImages({ title: TITLE, subtitle: DESCRIPTION, kind: "calc" }) },
  twitter: { card: DEFAULT_TWITTER_CARD, title: TITLE, description: DESCRIPTION, images: twitterImages({ title: TITLE, kind: "calc" }) },
};

export default function FinesCalcPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <PublicHeader />
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 sm:py-12">
        <PublicBreadcrumbs items={[{ name: "Калькуляторы", href: "/calc/journals" }, { name: "Штрафы" }]} tone="light" />
        <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[44px]">{TITLE}</h1>
        <p className="mt-3 max-w-[760px] text-[16px] leading-[1.7] text-[#3c4053]">{DESCRIPTION}</p>
        <FinesCalculator />
        <p className="mt-6 text-[12.5px] leading-relaxed text-[#9b9fb3]">
          Суммы по КоАП РФ в редакции на 2026 год, для справки. Размер конкретного штрафа определяет инспектор и суд; повторные нарушения и вред здоровью увеличивают санкции. Проверяйте актуальную редакцию статей.
        </p>
      </div>
      <PublicFooter />
    </div>
  );
}
