import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public/public-chrome";

/**
 * E19 — лендинги под ниши общепита. Каждая ниша имеет адаптированный
 * заголовок, выгоды и список «обязательных журналов» для этого типа
 * бизнеса. Цель — поднять SEO под запросы типа «электронные журналы
 * для кафе» и улучшить релевантность для конкретного посетителя.
 *
 * Роуты подключают этот компонент:
 *   /dlya-kafe         → kafe
 *   /dlya-pekarni      → pekarni
 *   /dlya-stolovoy     → stolovoy
 *   /dlya-proizvodstva → proizvodstva
 */

export type Niche = {
  slug: string;
  hero: string;
  audience: string;
  promise: string;
  pains: ReadonlyArray<string>;
  journals: ReadonlyArray<string>;
  cases: ReadonlyArray<{ before: string; after: string }>;
  metaTitle: string;
  metaDescription: string;
};

export const NICHES: Record<string, Niche> = {
  "dlya-kafe": {
    slug: "dlya-kafe",
    hero: "Электронные журналы для кафе и ресторанов",
    audience: "Кафе, рестораны, бары, кофейни",
    promise:
      "Все обязательные журналы СанПиН в одном кабинете. Повар заполняет с планшета на смене, управляющий видит сводку в Telegram, инспектору — PDF в один клик.",
    pains: [
      "Бракераж готовой продукции по 5 раз в день — повар не успевает",
      "Журнал температуры холодильников — забыли заполнить, штраф",
      "Гигиена перед сменой — формальность, бумаги теряются",
      "Перед проверкой РПН — паника и переписывание задним числом",
    ],
    journals: [
      "Бракераж готовой продукции",
      "Гигиена сотрудников",
      "Контроль температурного режима холодильного оборудования",
      "Журнал уборки и проветривания помещений",
      "Журнал входного контроля",
      "Журнал учёта дезинфицирующих средств",
      "Журнал санитарного дня",
    ],
    cases: [
      {
        before: "Шеф 30 минут перед открытием тратит на бракераж и подписи",
        after: "Бракераж — 3 минуты в Telegram-боте, прямо на телефоне",
      },
      {
        before: "Перед проверкой две ночи переписывали журналы",
        after: "PDF за месяц — одна кнопка, шапки и подписи на месте",
      },
    ],
    metaTitle: "Электронные журналы для кафе — WeSetup",
    metaDescription:
      "Электронные журналы СанПиН для кафе и ресторанов. Бракераж, гигиена, температура, входной контроль. Telegram-бот, PDF для Роспотребнадзора. Бесплатно до 5 сотрудников.",
  },
  "dlya-pekarni": {
    slug: "dlya-pekarni",
    hero: "Электронные журналы для пекарни и кондитерской",
    audience: "Пекарни, кондитерские, мини-производства выпечки",
    promise:
      "Журналы заквасок, термообработки, контроля сырья — без бумаги и потерь. Каждая партия выпечки прослеживаема: от поставщика муки до полки.",
    pains: [
      "Партии муки и дрожжей — бумажные накладные теряются между сменами",
      "Закваски надо вести по часам — кондитер забывает записать",
      "Бракераж пошагово на каждую партию — журнал не успевает",
      "При проверке РПН — нет ясной прослеживаемости от поставщика до продажи",
    ],
    journals: [
      "Журнал входного контроля сырья (мука, дрожжи, начинки)",
      "Журнал бракеража готовой выпечки",
      "Контроль температуры расстоечных шкафов и духовых",
      "Учёт работы оборудования и поверки термометров",
      "Журнал гигиены и медкнижек кондитеров",
      "Учёт партий — прослеживаемость по lot-номеру",
    ],
    cases: [
      {
        before: "Кондитер делает бракераж раз в день — реально надо каждую партию",
        after: "По каждой партии — push в Telegram «оцените», в один тап",
      },
    ],
    metaTitle: "Электронные журналы для пекарни и кондитерской — WeSetup",
    metaDescription:
      "Электронные журналы СанПиН для пекарни и кондитерской. Прослеживаемость партий, бракераж выпечки, контроль температуры расстоечных шкафов. Telegram-бот.",
  },
  "dlya-stolovoy": {
    slug: "dlya-stolovoy",
    hero: "Электронные журналы для столовой и школьного питания",
    audience: "Столовые, школьные столовые, корпоративное питание",
    promise:
      "Особо строгие требования СанПиН для детского/корпоративного питания. WeSetup закрывает обязательные журналы и автоматически готовит отчёты для проверок.",
    pains: [
      "Школьное питание — каждый день меню, бракераж по каждому блюду",
      "Огромный объём журналов: до 12 видов одновременно",
      "Меняется директор — бумажные журналы переписываются заново",
      "Проверка приходит без предупреждения — нужен порядок здесь и сейчас",
    ],
    journals: [
      "Бракераж готовой продукции (по каждому блюду в меню)",
      "Журнал входного контроля сырья",
      "Контроль качества фритюрных жиров",
      "Гигиена сотрудников и медкнижки",
      "Журнал уборки и санитарных дней",
      "Журнал контроля температуры холодильного оборудования",
      "Журнал жалоб (важно для родителей)",
      "Журнал интенсивного охлаждения горячих блюд (CCP по ХАССП)",
    ],
    cases: [
      {
        before: "Директор столовой ведёт 9 бумажных журналов вручную",
        after:
          "Все журналы в одном кабинете, повара заполняют с планшета, директор контролирует с компьютера",
      },
    ],
    metaTitle: "Электронные журналы для столовой и школы — WeSetup",
    metaDescription:
      "Электронные журналы СанПиН для столовой, школьного и корпоративного питания. Бракераж по каждому блюду, контроль фритюра, отчёты для Роспотребнадзора.",
  },
  "dlya-proizvodstva": {
    slug: "dlya-proizvodstva",
    hero: "Электронные журналы для пищевого производства",
    audience: "Пищевые производства, цеха, мясокомбинаты, молокозаводы",
    promise:
      "Полный ХАССП с критическими контрольными точками. Каждая партия — от приёмки до отгрузки — прослеживаема. Аудиты, CAPA, корректирующие действия — в системе.",
    pains: [
      "Десятки журналов одновременно — повар не справляется",
      "ХАССП требует CCP-журналы с критическими контрольными точками",
      "Каждый аудит — три недели подготовки, переписывание журналов",
      "Метал-детекторы и магниты — отдельный журнал, его всегда забывают",
    ],
    journals: [
      "Журнал ХАССП с CCP (термообработка, охлаждение)",
      "План аудитов и корректирующих действий (CAPA)",
      "Журнал контроля металлопримесей",
      "Прослеживаемость партий (lot-tracking)",
      "Журнал поверки оборудования (термометры, весы)",
      "Журнал технического обслуживания",
      "Журнал бракеража и списания",
      "Журнал учёта аварий и инцидентов",
    ],
    cases: [
      {
        before:
          "На производстве 12 журналов в бумажном виде — 3 человека ведут целый день",
        after:
          "Те же 12 журналов в WeSetup — один технолог + автозаполнение от датчиков",
      },
    ],
    metaTitle: "Электронные журналы для пищевого производства — WeSetup",
    metaDescription:
      "Электронные журналы ХАССП для пищевого производства, цехов, мясокомбинатов. CCP, прослеживаемость партий, аудиты, CAPA. Бесплатный тариф до 5 сотрудников.",
  },
};

/**
 * Build metadata for a route given the niche slug. Используется в
 * каждом dlya-XXX/page.tsx как `export const metadata`.
 */
export function getNicheMetadata(slug: string) {
  const data = NICHES[slug];
  if (!data) return { title: "Не найдено — WeSetup" };
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: {
      canonical: `https://wesetup.ru/${data.slug}`,
    },
    openGraph: {
      title: data.metaTitle,
      description: data.metaDescription,
      url: `https://wesetup.ru/${data.slug}`,
    },
  };
}

export function NicheLanding({ slug }: { slug: string }) {
  const data = NICHES[slug];
  if (!data) {
    // Не вызываем notFound() здесь — каждая страница-обёртка обязана
    // передавать существующий slug. Если не передан, роутинг показал
    // бы ошибку компиляции/404 раньше, до этого компонента.
    throw new Error(`Unknown niche: ${slug}`);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: data.metaTitle,
    description: data.metaDescription,
    url: `https://wesetup.ru/${data.slug}`,
    inLanguage: "ru-RU",
    isPartOf: { "@id": "https://wesetup.ru/#website" },
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicHeader />

      {/* HERO */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0b1024] px-5 py-12 text-white sm:px-6 sm:py-16 md:px-12 md:py-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
            <div className="absolute -bottom-32 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              <Sparkles className="size-3.5" />
              {data.audience}
            </div>
            <h1 className="mt-5 max-w-[820px] text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[52px]">
              {data.hero}
            </h1>
            <p className="mt-5 max-w-[680px] text-[16px] leading-[1.6] text-white/80 md:text-[18px]">
              {data.promise}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-semibold text-[#0b1024] transition-transform hover:-translate-y-0.5"
              >
                Начать бесплатно
                <ArrowRight className="size-4 text-[#5566f6] transition-transform group-hover:translate-x-1" />
              </Link>
              <div className="text-[12px] text-white/60">
                Без карты · Все журналы включены
              </div>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur">
              <ShieldCheck className="size-3.5 text-emerald-300" />
              Законно с 2021 г. — СанПиН 2.3/2.4.3590-20
            </div>
          </div>
        </div>
      </section>

      {/* PAINS */}
      <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 max-w-[640px]">
          <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            Знакомо?
          </div>
          <h2 className="text-[clamp(1.5rem,1.8vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
            Боли, которые WeSetup закрывает
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.pains.map((p) => (
            <div
              key={p}
              className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-5 text-[14px] leading-[1.6] text-[#3c4053]"
            >
              {p}
            </div>
          ))}
        </div>
      </section>

      {/* JOURNALS */}
      <section className="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="mb-8 max-w-[640px]">
          <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            Обязательные журналы для вашей ниши
          </div>
          <h2 className="text-[clamp(1.5rem,1.8vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
            Какие журналы вам понадобятся
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.journals.map((j) => (
            <div
              key={j}
              className="flex items-start gap-2 rounded-2xl border border-[#ececf4] bg-white p-4 text-[14px] leading-snug text-[#0b1024]"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>{j}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CASES */}
      {data.cases.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6 sm:pb-20">
          <div className="mb-8 max-w-[640px]">
            <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
              До и после
            </div>
            <h2 className="text-[clamp(1.5rem,1.8vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
              Что меняется в работе
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {data.cases.map((c, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#ececf4] bg-white p-5 sm:p-6"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a13a32]">
                  Было
                </div>
                <p className="mt-1 text-[14px] leading-[1.55] text-[#3c4053]">
                  {c.before}
                </p>
                <div className="my-3 inline-flex items-center gap-1.5 rounded-full bg-[#eef1ff] px-2.5 py-1 text-[12px] text-[#3848c7]">
                  <Clock className="size-3.5" />
                  WeSetup
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Стало
                </div>
                <p className="mt-1 text-[14px] leading-[1.55] text-[#0b1024]">
                  {c.after}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#0b1024] via-[#1a234a] to-[#3848c7] p-7 text-center text-white shadow-[0_30px_80px_-30px_rgba(11,16,36,0.55)] sm:p-12">
          <h2 className="text-[clamp(1.5rem,2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Начните вести журналы прямо сегодня
          </h2>
          <p className="mx-auto mt-3 max-w-[520px] text-[14px] text-white/80">
            Бесплатный тариф навсегда: до 5 сотрудников, все 35 журналов
            включены, без привязки карты.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-[14px] font-semibold text-[#0b1024] hover:bg-white/90"
          >
            Начать бесплатно
            <ArrowRight className="size-4 text-[#5566f6]" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
