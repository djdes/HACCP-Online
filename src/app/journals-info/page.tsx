import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Layers,
  Search,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public/public-chrome";
import {
  JOURNAL_INFO,
  JOURNAL_CATEGORY_LABEL,
  type JournalInfo,
} from "@/content/journal-info";
import { NICHES } from "@/components/landing/niche-landing";
import { SEO_LANDINGS } from "@/components/landing/seo-journal-landing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Электронные журналы — каталог WeSetup",
  description:
    "Полный каталог из 35 электронных журналов ХАССП и СанПиН, которые ведёт WeSetup: гигиена, температуры, бракераж, уборка, ДДД и многое другое.",
};

const CATEGORY_ORDER: Array<JournalInfo["category"]> = [
  "sanpin_daily",
  "sanpin_periodic",
  "haccp",
];

export default function JournalsInfoListPage() {
  const all = Object.values(JOURNAL_INFO);
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    label: JOURNAL_CATEGORY_LABEL[category],
    items: all.filter((j) => j.category === category),
  }));

  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <PublicHeader activeSection="journals-info" />

      {/* HERO */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0b1024] px-5 py-10 text-white sm:px-6 sm:py-14 md:px-12 md:py-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
            <div className="absolute -bottom-32 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              <BookOpenCheck className="size-3.5" /> Каталог журналов
            </div>
            <h1 className="mt-4 max-w-[780px] text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[56px]">
              {all.length} журналов СанПиН и ХАССП в одном сервисе
            </h1>
            <p className="mt-5 max-w-[720px] text-[16px] leading-[1.6] text-white/80 md:text-[18px]">
              Всё, что требует СанПиН 2.3/2.4.3590-20 и план ХАССП: от
              ежедневного журнала здоровья до журналов аудита и
              прослеживаемости. Кликните по любому, чтобы посмотреть, что
              заполняется и какая норма требует.
            </p>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
        {grouped.map((group) => (
          <div key={group.category} className="mb-14">
            <div className="flex items-center gap-3">
              <Layers className="size-5 text-[#3848c7]" />
              <h2 className="text-[24px] font-semibold tracking-tight">
                {group.label}
              </h2>
              <span className="text-[14px] text-[#6f7282]">
                {group.items.length}
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((j) => (
                <Link
                  key={j.code}
                  href={`/journals-info/${j.code}`}
                  className="group flex min-w-0 flex-col rounded-2xl border border-[#ececf4] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#5566f6]/40 hover:shadow-[0_16px_40px_-24px_rgba(85,102,246,0.35)]"
                >
                  <div className="break-all text-[11px] font-medium uppercase tracking-[0.14em] text-[#6f7282]">
                    {j.code}
                  </div>
                  <div className="mt-1 text-[17px] font-semibold leading-snug group-hover:text-[#3848c7]">
                    {j.tagline}
                  </div>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-[1.55] text-[#6f7282]">
                    {j.why}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-[#3848c7]">
                    Подробнее
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* PIVOT: niche-лендинги + SEO-страницы. /journals-info — это
          каталог по нормативам; этот блок даёт второй вход тем, кто
          ищет «для кафе» или «журнал ХАССП скачать». */}
      <section className="mx-auto max-w-[1200px] px-4 pb-12 sm:px-6 sm:pb-14">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-[#ececf4] bg-white p-6 sm:p-8">
            <div className="mb-2 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
              <Building2 className="size-3.5" />
              По типу бизнеса
            </div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
              Журналы для вашей ниши
            </h2>
            <p className="mt-2 text-[13px] text-[#6f7282]">
              Конкретный список журналов, который требует именно ваш тип
              заведения.
            </p>
            <div className="mt-4 grid gap-2">
              {Object.values(NICHES).map((n) => (
                <Link
                  key={n.slug}
                  href={`/${n.slug}`}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-[#ececf4] bg-[#fafbff] px-3.5 py-2.5 text-[13px] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                >
                  <span className="text-[#0b1024] group-hover:text-[#3848c7]">
                    {n.audience}
                  </span>
                  <ArrowRight className="size-4 text-[#9b9fb3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#ececf4] bg-white p-6 sm:p-8">
            <div className="mb-2 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
              <Search className="size-3.5" />
              Частые запросы
            </div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
              Ищете конкретный журнал?
            </h2>
            <p className="mt-2 text-[13px] text-[#6f7282]">
              Отдельные страницы под популярные поисковые запросы — с
              описанием полей и СанПиН-обоснованием.
            </p>
            <div className="mt-4 grid gap-2">
              {Object.values(SEO_LANDINGS).slice(0, 7).map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}`}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-[#ececf4] bg-[#fafbff] px-3.5 py-2.5 text-[13px] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                >
                  <span className="line-clamp-1 text-[#0b1024] group-hover:text-[#3848c7]">
                    {s.hero}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-[#9b9fb3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="rounded-3xl border border-[#ececf4] bg-[#fafbff] px-5 py-8 text-center sm:px-8 sm:py-12">
          <div className="text-[22px] font-semibold tracking-tight sm:text-[26px]">
            Попробуйте все журналы бесплатно
          </div>
          <p className="mx-auto mt-2 max-w-[520px] text-[14px] text-[#6f7282]">
            Все журналы — на бесплатном тарифе навсегда, без привязки
            карты. Если нужно больше сотрудников или автоматизация, подписка
            подключается за минуту.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#5566f6] px-5 py-3 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
          >
            Попробовать
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
