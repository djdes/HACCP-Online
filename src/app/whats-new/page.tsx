import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lightbulb, Rss } from "lucide-react";

import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { CHANGELOG } from "@/content/changelog";
import { ogImages, twitterImages } from "@/lib/og-image";
import { DEFAULT_TWITTER_CARD } from "@/lib/meta-defaults";

const TITLE = "Что нового в WeSetup";
const DESCRIPTION = "История изменений электронных журналов СанПиН и ХАССП: что появилось, что починили, что взяли из идей клиентов.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://wesetup.ru/whats-new", types: { "application/rss+xml": "https://wesetup.ru/whats-new/feed.xml" } },
  openGraph: { type: "website", locale: "ru_RU", siteName: "WeSetup", url: "https://wesetup.ru/whats-new", title: TITLE, description: DESCRIPTION, images: ogImages({ title: TITLE, subtitle: DESCRIPTION, kind: "changelog" }) },
  twitter: { card: DEFAULT_TWITTER_CARD, title: TITLE, description: DESCRIPTION, images: twitterImages({ title: TITLE, kind: "changelog" }) },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("ru-RU", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}

/** Публичная история изменений: индексируемая страница и RSS. */
export default function WhatsNewPage() {
  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <div className="mx-auto max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
        <PublicBreadcrumbs items={[{ name: "Что нового" }]} tone="light" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">Что нового</h1>
            <p className="mt-2 max-w-[600px] text-[15px] leading-[1.6] text-[#3c4053]">{DESCRIPTION}</p>
          </div>
          <a
            href="/whats-new/feed.xml"
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            <Rss className="size-4 text-[#5566f6]" />
            RSS
          </a>
        </div>

        <ol className="mt-10 space-y-8">
          {CHANGELOG.map((entry) => (
            <li key={entry.slug} id={entry.slug} className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              </div>
              <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{entry.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {entry.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.6] text-[#3c4053]">
                    <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#5566f6]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-3xl border border-[#ececf4] bg-[#fafbff] p-6 md:p-7">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Lightbulb className="size-4 text-[#5566f6]" />
            Многое здесь — из идей клиентов
          </div>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-[#3c4053]">
            В кабинете есть раздел «Идеи»: предложите, чего не хватает, и голосуйте за чужие предложения. Что набирает голоса, попадает в план.
          </p>
          <Link href="/register" className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]">
            Попробовать WeSetup
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
