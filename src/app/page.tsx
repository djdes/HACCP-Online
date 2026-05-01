import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BellRing,
  Building2,
  CheckCircle2,
  Clock,
  Cloud,
  Gift,
  Handshake,
  HelpCircle,
  ImageIcon,
  Leaf,
  Network,
  NotebookText,
  Plug,
  Rocket,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Timer,
  UserCheck,
  Users,
  Wand2,
  Wrench,
} from "lucide-react";
import { db } from "@/lib/db";
import { PricingCalculator } from "@/components/public/pricing-calculator";
import { PublicFooter } from "@/components/public/public-chrome";
import { ScreenshotFan } from "@/components/public/screenshot-fan";
import { LandingMotion } from "@/components/public/landing-motion";
import { CursorGlow } from "@/components/public/cursor-glow";
import { RoiCalculator } from "@/components/landing/roi-calculator";
import { DemoJournalWidget } from "@/components/landing/demo-journal-widget";
import { JournalAutoplayVideo } from "@/components/landing/journal-autoplay-video";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getWebHomeHref } from "@/lib/role-access";
import { jsonLdSafeString } from "@/lib/json-ld";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title:
    "WeSetup — электронные журналы СанПиН и ХАССП. Бесплатно навсегда",
  description:
    "35 электронных журналов для общепита и пищевых производств. Гигиена, температура, бракераж, уборка, дезинфекция. Автозаполнение, Telegram-бот, PDF для Роспотребнадзора. Бесплатно до 5 сотрудников.",
  alternates: { canonical: "https://wesetup.ru/" },
};

const FEATURES = [
  {
    icon: Plug,
    slug: "sync-iiko-1c",
    title: "Синхронизация с iiko / 1С",
    text: "Подтягиваем поставщиков, продукты и поступления — бракераж и входной контроль заполняются автоматически.",
  },
  {
    icon: Wand2,
    slug: "autofill",
    title: "Автозаполнение",
    text: "Гигиена, температуры, уборка — сервис подставляет значения там, где это безопасно и разрешено.",
  },
  {
    icon: Cloud,
    slug: "cloud",
    title: "Всё в облаке",
    text: "Журналы доступны из любой точки — компьютер, планшет у шефа, телефон в цехе. История сохраняется.",
  },
  {
    icon: UserCheck,
    slug: "role-access",
    title: "Доступы по ролям",
    text: "Каждый сотрудник видит только свои журналы. Управляющий видит всех и может закрыть период.",
  },
  {
    icon: BellRing,
    slug: "reminders",
    title: "Напоминания",
    text: "Почта и Telegram пишут, если до конца смены остался незаполненный журнал. Конец дня — журналы закрыты.",
  },
  {
    icon: Bell,
    slug: "alerts",
    title: "Алерты о нарушениях",
    text: "Температура вне нормы, просрочка, отклонение — уведомление ответственному в реальном времени.",
  },
  {
    icon: Leaf,
    slug: "paperless",
    title: "Без бумаги",
    text: "Не нужно покупать журналы, заводить распечатки, хранить коробки — все записи сразу в электронном виде.",
  },
  {
    icon: Timer,
    slug: "time-saving",
    title: "Экономия времени",
    text: "5–10 минут на заполнение всех журналов в конце смены вместо часа возни с бумагой и пастами.",
  },
];

const JOURNAL_PREVIEW: Array<{ code: string; name: string }> = [
  { code: "hygiene", name: "Гигиенический журнал" },
  { code: "health_check", name: "Журнал здоровья (ЗОЖ)" },
  { code: "climate_control", name: "Контроль температуры и влажности" },
  { code: "cleaning", name: "Журнал уборки помещений" },
  { code: "uv_lamp_runtime", name: "Работа УФ-бактерицидной установки" },
  { code: "finished_product", name: "Бракераж готовой продукции" },
  { code: "fryer_oil", name: "Учёт фритюрных жиров" },
  { code: "cold_equipment_control", name: "Температура холодильного оборудования" },
  { code: "cleaning_ventilation_checklist", name: "Чек-лист проветривания" },
  { code: "general_cleaning", name: "График генеральных уборок" },
  { code: "incoming_control", name: "Приёмка и входной контроль сырья" },
  { code: "med_books", name: "Медицинские книжки" },
];

const STEPS = [
  {
    title: "Оставьте заявку",
    text: "Напишите нам в Telegram или через форму — уточним формат и количество заведений.",
  },
  {
    title: "Первичный созвон",
    text: "Покажем систему, ответим на вопросы, обсудим тариф и план перехода.",
  },
  {
    title: "Бесплатный старт",
    text: "Регистрируетесь и сразу ведёте настоящие журналы — без пробного периода и карты. До 5 сотрудников всё бесплатно навсегда.",
  },
  {
    title: "Ведение журналов",
    text: "Смена за сменой — сервис напоминает, подставляет автозначения, хранит историю для проверок.",
  },
];

const AUDIENCE_CHIPS: string[] = [
  "Рестораны",
  "Кафе",
  "Пекарни",
  "Кондитерские",
  "Столовые",
  "Отели",
  "Фуд-корты",
  "Кейтеринг",
  "Школьные кухни",
  "Производственные цеха",
  "Тёмные кухни",
  "Сети общепита",
];

const AUDIENCE = [
  {
    icon: Store,
    title: "Одно или несколько заведений",
    text: "Кафе, ресторан, столовая — один владелец видит все точки в одном окне.",
  },
  {
    icon: Network,
    title: "Сетевые и производственные площадки",
    text: "Единые шаблоны на все филиалы, понятный периметр проверок Роспотребнадзора.",
  },
  {
    icon: Building2,
    title: "Объединения рестораторов",
    text: "Общий доступ к корпоративным настройкам и централизованная отчётность.",
  },
  {
    icon: Users,
    title: "Консалтинг по ХАССП / HoReCa",
    text: "Приводите клиентов в готовую инфраструктуру, закрывайте проекты быстрее.",
  },
  {
    icon: Rocket,
    title: "IT-компании",
    text: "Интегрируетесь в наш API, добавляете электронные журналы как модуль вашей экосистемы.",
  },
];

const FAQ = [
  {
    q: "Что такое электронный журнал для общепита?",
    a: "Веб-сервис, куда сотрудники вносят те же записи, что раньше делали в бумажных журналах — гигиена, температура, бракераж и так далее. С 1 января 2021 года такой формат разрешён СанПиН 2.3/2.4.3590-20.",
  },
  {
    q: "Как проходит проверка Роспотребнадзором?",
    a: "Инспектору выгружается PDF со всеми записями за запрошенный период. Формат печати соответствует требованиям: ФИО, должность, электронная подпись, дата и ключевые значения.",
  },
  {
    q: "Есть ли синхронизация с iiko и 1С?",
    a: "Да. Поставщики, продукты, поступления и бракераж подтягиваются автоматически, чтобы руками вбивать не приходилось. Настройка — около 30 минут вместе с нашим инженером.",
  },
  {
    q: "Где указано, что можно вести журналы в электронном виде?",
    a: "СанПиН 2.3/2.4.3590-20 «Санитарно-эпидемиологические требования к организации общественного питания населения», действует с 1 января 2021 года. Электронная форма прямо разрешена.",
  },
  {
    q: "Можно попробовать бесплатно?",
    a: "Да — бесплатный тариф действует навсегда: до 5 сотрудников все 35 журналов включены без ограничений по времени и без привязки карты. Подписку оформляете, только если нужно больше рабочих мест или автоматизация с датчиками.",
  },
  {
    q: "Что если пропадёт интернет?",
    a: "Ничего страшного: интерфейс продолжает работать на планшете, записи сохраняются локально и автоматически уходят на сервер при появлении сети. Пропустить смену из-за проблем с WiFi нельзя.",
  },
  {
    q: "Безопасны ли мои данные?",
    a: "Все журналы хранятся в защищённой PostgreSQL-базе на серверах в России. Резервные копии — каждые 6 часов. Передача — по HTTPS с TLS 1.3. Доступ — только по логину/паролю с ролевой моделью; PDF-выгрузка для проверок только с учётной записью администратора.",
  },
  {
    q: "Можно ли перенести данные из Excel/бумаги?",
    a: "Да. Импорт сотрудников, оборудования и поставщиков — из Excel-таблицы. Старые бумажные записи остаются у вас, новые ведутся в WeSetup; можно опционально оцифровать архив за деньги.",
  },
  {
    q: "Подходит ли для школьного питания / больниц / детских садов?",
    a: "Да. Те же СанПиН-журналы (гигиена, термообработка, бракераж, входной контроль) обязательны и для школ/больниц. Шаблоны общие; адаптация под специфику — в настройках.",
  },
];

export default async function LandingPage() {
  // Auth state — для адаптации nav/CTA. Лендинг остаётся публичным,
  // но залогиненный видит «Открыть кабинет» вместо «Войти/Начать».
  const session = await getServerSession(authOptions).catch(() => null);
  const isAuthed = Boolean(session?.user);
  const homeHref = isAuthed
    ? getWebHomeHref({
        role: session?.user?.role ?? "",
        isRoot: session?.user?.isRoot === true,
      })
    : "/dashboard";
  const userInitials = (session?.user?.name ?? "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const latestArticles = await db.article
    .findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        tags: true,
        readMinutes: true,
        publishedAt: true,
      },
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[landing] Failed to load latest articles: ${message}`);
      return [];
    });

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://wesetup.ru/#org",
        name: "WeSetup",
        url: "https://wesetup.ru",
        logo: "https://wesetup.ru/icons/icon-512.png",
        sameAs: ["https://t.me/wesetupbot"],
      },
      {
        "@type": "WebSite",
        "@id": "https://wesetup.ru/#website",
        url: "https://wesetup.ru",
        name: "WeSetup",
        publisher: { "@id": "https://wesetup.ru/#org" },
        inLanguage: "ru-RU",
      },
      {
        "@type": "SoftwareApplication",
        name: "WeSetup",
        applicationCategory: "BusinessApplication",
        // Native iOS/Android apps пока не выпущены — у нас Web + Telegram
        // Mini App. Не врём в JSON-LD: «Telegram Mini App» — это Web,
        // фактически работает на iOS/Android внутри Telegram, но это не
        // отдельные native приложения. Когда они появятся, поменяем.
        operatingSystem: "Web",
        description:
          "Электронные журналы СанПиН и ХАССП для общепита и пищевых производств. 35 журналов, автозаполнение, Telegram-бот, PDF для Роспотребнадзора.",
        // image — required для SoftwareApplication rich result в Google.
        // Раньше отдавали icon-512 (квадрат), но Google рекомендует
        // landscape для product/app rich-результатов. /og-default —
        // 1200×630 brand-hero, лучше карточка в выдаче.
        image: ["https://wesetup.ru/og-default"],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "RUB",
          description: "Бесплатный тариф до 5 сотрудников",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "Product",
        name: "WeSetup — электронные журналы СанПиН и ХАССП",
        description:
          "35 журналов для общепита и пищевых производств. Telegram-бот, автозаполнение, PDF для проверок Роспотребнадзора.",
        // image — required для Product rich result. Без него Google не
        // показывает Offer-карточку с ценой/доступностью в выдаче.
        // 1200×630 landscape лучше квадрата для Product rich snippet.
        image: ["https://wesetup.ru/og-default"],
        brand: { "@id": "https://wesetup.ru/#org" },
        offers: [
          {
            "@type": "Offer",
            name: "Бесплатный",
            price: "0",
            priceCurrency: "RUB",
            description: "До 5 сотрудников, все 35 журналов, бессрочно",
            availability: "https://schema.org/InStock",
          },
          {
            "@type": "Offer",
            name: "Подписка",
            price: "1990",
            priceCurrency: "RUB",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "1990",
              priceCurrency: "RUB",
              unitText: "месяц",
            },
            description:
              "Без лимита по сотрудникам, IoT-датчики, автозаполнение",
            availability: "https://schema.org/InStock",
          },
        ],
      },
    ],
  };

  return (
    <div className="landing-page min-h-screen bg-white text-[#0b1024]">
      <LandingMotion />
      <CursorGlow />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafeString(jsonLd) }}
      />
      {/* NAV — solid white, sticky so hero blobs don't bleed through on scroll */}
      <div className="landing-nav sticky top-0 z-40 border-b border-[#ececf4] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-[0.22em] text-[#0b1024] sm:text-[17px]"
          >
            WESETUP
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/journals-info"
              className="hidden text-[14px] font-medium text-[#6f7282] transition-colors hover:text-[#0b1024] sm:inline"
            >
              Журналы
            </Link>
            <Link
              href="/blog"
              className="hidden text-[14px] font-medium text-[#6f7282] transition-colors hover:text-[#0b1024] sm:inline"
            >
              Блог
            </Link>
            {isAuthed ? (
              <>
                <Link
                  href={homeHref}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-3.5 text-[13px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] sm:px-4 sm:text-[14px]"
                >
                  Открыть кабинет
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href={homeHref}
                  title={session?.user?.name ?? "Профиль"}
                  aria-label={`Профиль · ${session?.user?.name ?? ""}`}
                  className="hidden size-10 items-center justify-center rounded-full border border-[#dcdfed] bg-[#f5f6ff] text-[12px] font-semibold text-[#3848c7] transition-colors hover:border-[#5566f6]/50 hover:bg-[#eef1ff] sm:inline-flex"
                >
                  {userInitials}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden h-10 items-center rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] sm:inline-flex"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-3.5 text-[13px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] sm:px-4 sm:text-[14px]"
                >
                  Начать
                  <ArrowRight className="size-4" />
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>

      {/* HERO — centered stack, megaplan-inspired */}
      {/* overflow-x-clip contains the tilted phones horizontally, but lets
          vertical shadows + natural-height children extend freely so they
          don't get guillotined by the section boundary. */}
      <section className="landing-hero relative overflow-x-clip pb-14 sm:pb-32">
        {/* Soft ambient gradient wash */}
        <div
          className="pointer-events-none absolute inset-0 -z-0"
          aria-hidden="true"
        >
          <div className="absolute left-[10%] top-[-8%] size-[720px] rounded-full bg-[#5566f6] opacity-[0.08] blur-[140px]" />
          <div className="absolute right-[5%] top-[40%] size-[620px] rounded-full bg-[#7a5cff] opacity-[0.07] blur-[140px]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(11,16,36,0.10) 1px, transparent 0)",
              backgroundSize: "28px 28px",
              maskImage:
                "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
            }}
          />
          {/* Smooth fade to white at both ends so the hero "breathes" into
              the page instead of cutting abruptly */}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
        </div>

        <div className="relative mx-auto max-w-[1100px] px-4 sm:px-6 pt-8 text-center sm:pt-16">
          {/* Registry badge */}
          <div className="hero-badge inline-flex items-center gap-2 rounded-full border border-[#dcdfed] bg-white/80 px-3.5 py-1.5 text-[12px] font-medium text-[#3848c7] backdrop-blur">
            <ShieldCheck className="size-3.5" />
            В реестре отечественного ПО
            <span className="text-[#9b9fb3]">·</span>
            <span className="text-[#6f7282]">заявка №27419</span>
          </div>

          {/* Headline — fluid scale: 32 px on phones → 72 px on desktop,
              linear in between via clamp() so the headline reads well on
              every viewport width without breakpoint jumps. */}
          <h1 className="hero-title mx-auto mt-8 max-w-[920px] text-[clamp(2rem,6.5vw+0.25rem,4.5rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-[#0b1024]">
            Электронные журналы
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">для вашей кухни</span>
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-[0.08em] -z-0 h-[0.28em] bg-[#5566f6]/15"
              />
            </span>
          </h1>

          {/* Subhead */}
          <p className="hero-copy mx-auto mt-7 max-w-[640px] text-[16px] leading-[1.6] text-[#3c4053] sm:text-[18px]">
            СанПиН и ХАССП в одной системе. Заполняете с планшета на кухне
            или из Telegram, PDF для Роспотребнадзора — в один клик.
            Бесплатно навсегда до 5 сотрудников.
          </p>

          {/* Compliance proof — на видном месте, чтобы менеджер сразу
              видел что электронные журналы законны (D15). */}
          <div className="hero-legal mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-[#dcdfed] bg-white/80 px-3.5 py-1.5 text-[12px] font-medium text-[#3c4053] backdrop-blur">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            Законно с 2021 г. — СанПиН 2.3/2.4.3590-20
          </div>

          {/* Single big CTA — для залогиненного «Открыть кабинет»,
              для анонимного — «Начать бесплатно» (регистрация) */}
          <div className="hero-cta mt-10 flex flex-col items-center gap-3">
            <Link
              href={isAuthed ? homeHref : "/register"}
              className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-semibold text-white shadow-[0_20px_50px_-20px_rgba(85,102,246,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[#4a5bf0] hover:shadow-[0_24px_55px_-18px_rgba(85,102,246,0.65)] sm:h-[56px] sm:px-8 sm:text-[16px]"
            >
              {isAuthed ? "Открыть кабинет" : "Начать бесплатно"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <div className="text-[12px] text-[#9b9fb3]">
              {isAuthed
                ? `Залогинены как ${session?.user?.name ?? ""}`
                : "Без карты · Всё включено на бесплатном тарифе"}
            </div>
          </div>

          {/* Audience chips */}
          <div className="hero-chips mx-auto mt-14 max-w-[860px]">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b9fb3]">
              Подходит для
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {AUDIENCE_CHIPS.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center rounded-full border border-[#ececf4] bg-white px-4 py-2 text-[13px] font-medium text-[#3c4053] shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>

          {/* Screenshot fan — single mobile phone needs ~400px (9:19 ratio
              at 180px width = 380px tall + 20px breathing room). Fan with
              two tilted phones + desktop mockup needs ~680px. Height scales
              down aggressively on <sm so the hero isn't 90% whitespace on
              a phone — previous `min-h-[420px]` left ~40px dead strip below
              the phone that made the mobile hero look broken. */}
          <div className="hero-fan relative mx-auto mt-10 min-h-[400px] max-w-[1100px] sm:mt-20 sm:min-h-[620px] md:min-h-[680px]">
            <ScreenshotFan />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 py-20">
        <div className="mb-12 max-w-[720px]">
          <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            Что внутри
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Всё, что нужно, чтобы журналы действительно вели — а не «для галочки»
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={`/features/${f.slug}`}
              className="group flex flex-col rounded-2xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:-translate-y-0.5 hover:border-[#5566f6]/40 hover:shadow-[0_14px_32px_-16px_rgba(85,102,246,0.28)]"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6] transition-transform group-hover:scale-105">
                <f.icon className="size-6" />
              </div>
              <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024] group-hover:text-[#3848c7]">
                {f.title}
              </div>
              <p className="mt-2 flex-1 text-[13px] leading-[1.55] text-[#6f7282]">
                {f.text}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-[#3848c7] opacity-0 transition-opacity group-hover:opacity-100">
                Подробнее
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* C9 — interactive demo journal: позволяет посетителю «потрогать»
          форму без регистрации. Снимает страх «слишком сложно». */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-8 max-w-[640px]">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            <Wand2 className="size-4" />
            Попробуйте сами
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Заполните журнал прямо здесь — без регистрации
          </h2>
          <p className="mt-3 text-[15px] text-[#6f7282]">
            Это контроль температуры холодильника — типичный ежедневный
            журнал. Введите данные и сохраните, чтобы увидеть как это
            работает в реальном WeSetup.
          </p>
        </div>
        <DemoJournalWidget />
      </section>

      {/* TRIAL BANNER */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-[#0b1024] px-5 py-10 text-white sm:px-8 sm:py-14 md:px-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 right-0 size-[400px] rounded-full bg-[#7cf5c0] opacity-20 blur-[120px]" />
            <div className="absolute -bottom-24 -left-10 size-[420px] rounded-full bg-[#5566f6] opacity-30 blur-[120px]" />
          </div>
          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[560px]">
              <h3 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                Бесплатно навсегда. Без карты.
              </h3>
              <p className="mt-3 text-[15px] text-white/70">
                Создайте организацию за 10 минут и начните вести
                журналы прямо сегодня. Платите, только если нужно больше
                рабочих мест или автоматизация.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-medium text-[#0b1024] transition-colors hover:bg-white/90"
            >
              Начать бесплатно
              <ArrowRight className="size-4 text-[#5566f6]" />
            </Link>
          </div>
        </div>
      </section>

      {/* JOURNALS CATALOG */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-[640px]">
            <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
              35 журналов
            </div>
            <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
              Какие журналы уже внутри
            </h2>
            <p className="mt-4 text-[15px] text-[#6f7282]">
              Ежедневные санитарные журналы и полный ХАССП: аудиты, обучение,
              поверки, прослеживаемость, обслуживание оборудования, жалобы,
              СИЗ. Все журналы — бесплатно, без ограничений по времени.
            </p>
          </div>
          <Link
            href="/journals-info"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            Смотреть весь список
            <ArrowRight className="size-4 text-[#5566f6]" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNAL_PREVIEW.map((j, idx) => (
            <Link
              key={j.code}
              href={`/journals-info/${j.code}`}
              className="group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3 text-[14px] font-medium text-[#0b1024] shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:-translate-y-0.5 hover:border-[#5566f6]/40 hover:shadow-[0_12px_28px_-16px_rgba(85,102,246,0.22)]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5f6ff] text-[12px] font-semibold text-[#5566f6]">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 leading-snug group-hover:text-[#3848c7]">
                {j.name}
              </span>
              <ArrowRight className="size-4 shrink-0 text-[#5566f6] opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 max-w-[720px]">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            <Gift className="size-4" />
            Тарифы
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Все журналы бесплатно. Платите за автоматизацию.
          </h2>
          <p className="mt-4 text-[15px] text-[#6f7282]">
            Подписка единая — 1 990 ₽/мес. Пакеты отличаются только
            набором оборудования и услугами: приехать, подключить
            датчики к холодильникам, настроить профили и обучить смену.
            Всё железо — разовая покупка.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Free tier */}
          <PricingCard
            kind="free"
            name="Бесплатный"
            from="0 ₽"
            period="навсегда"
            description="Доступ ко всем журналам без ограничений по времени. Для заведения с небольшой сменой."
            points={[
              "До 5 сотрудников",
              "Все 35 журналов СанПиН + ХАССП",
              "Telegram-бот с wizard заполнения",
              "PDF для проверок, без привязки карты",
            ]}
            ctaLabel="Начать бесплатно"
            ctaHref="/register"
          />

          {/* Subscription tier (user brings own equipment) */}
          <PricingCard
            kind="team"
            name="Подписка"
            from="1 990 ₽"
            period="в месяц"
            description="Если датчики, планшеты и брелоки уже есть — подключаем их к WeSetup и снимаем все ограничения."
            points={[
              "Без лимита по сотрудникам",
              "Подключение своих IoT-датчиков",
              "Автозаполнение температур и гигиены",
              "Приоритетная поддержка в Telegram",
            ]}
            ctaLabel="Начать бесплатно"
            ctaHref="/register"
            highlighted
            badge="Популярный"
          />

          {/* Subscription + equipment bundle with live calculator */}
          <div className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
                <Wrench className="size-5" />
              </span>
              <div className="text-[20px] font-semibold tracking-[-0.01em] text-[#0b1024]">
                Подписка + оборудование
              </div>
            </div>
            <p className="mt-4 text-[14px] leading-[1.55] text-[#6f7282]">
              Выберите, что нужно — цена пересчитается. Уже есть планшет
              или датчики — снимите галочку, и останется только подписка.
            </p>
            <div className="mt-5">
              <PricingCalculator />
            </div>
          </div>
        </div>
        <div className="mt-4 text-center text-[13px] text-[#9b9fb3]">
          Годовая оплата подписки — −20%. Железо — один раз.
        </div>
      </section>

      {/* C5 — D11+D12 поднимаются после PRICING: безопасность и ROI это
          trust-сигналы которые усиливают тарифное решение, и они не
          должны прятаться в самый низ страницы. */}

      {/* D11 — БЕЗОПАСНОСТЬ ДАННЫХ */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            <ShieldCheck className="size-4" />
            Безопасность данных
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Журналы не пропадут — это первое что мы продумали
          </h2>
          <p className="mt-3 text-[15px] text-[#6f7282]">
            Общепит боится потерять год записей перед проверкой. Мы храним
            ваши данные как банк хранит транзакции — с дублированием,
            шифрованием и аудитом доступа.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShieldCheck,
              title: "Серверы в России",
              text: "152-ФЗ. PostgreSQL хостится в РФ-датацентре с суточной репликацией.",
            },
            {
              icon: Network,
              title: "TLS 1.3 + HMAC",
              text: "Передача только по HTTPS, межсервисные запросы подписаны HMAC-SHA256.",
            },
            {
              icon: Timer,
              title: "Бэкапы каждые 6 часов",
              text: "Снапшоты держим 30 дней, ежедневно проверяем валидность восстановления.",
            },
            {
              icon: UserCheck,
              title: "Ролевой доступ",
              text: "У каждого сотрудника свой логин. Каждое действие видно в audit-логе.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
            >
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
                <item.icon className="size-5" />
              </div>
              <div className="mt-3 text-[14px] font-semibold text-[#0b1024]">
                {item.title}
              </div>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#6f7282]">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* D12 — ROI КАЛЬКУЛЯТОР */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <RoiCalculator />
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            Как подключиться
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Переход на электронный журнал — полдня работы
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, idx) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#5566f6] text-[13px] font-semibold text-white">
                  {idx + 1}
                </span>
                <span className="text-[15px] font-semibold text-[#0b1024]">
                  {step.title}
                </span>
              </div>
              <p className="text-[13px] leading-[1.55] text-[#6f7282]">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* D13 — illustrative cases (типовые сценарии, не реальные клиенты).
          Реальные брендированные кейсы вернутся когда появятся подписанные
          разрешения на показ — пока даём «вилки» на основе наблюдений.   */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            <Sparkles className="size-4" />
            До и после
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Типичные результаты перехода с бумаги
          </h2>
          <p className="mt-3 text-[15px] text-[#6f7282]">
            Цифры — на основе наблюдений за заведениями, которые перешли с
            бумажных журналов. Точная экономия зависит от количества журналов
            и сотрудников.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Кафе на 10 сотрудников",
              before:
                "Шеф 30 минут утром тратит на бракераж и проверку гигиены. Журналы заполняются вечером «задним числом».",
              after:
                "Бракераж и гигиена через Telegram-бот за 3 минуты. Перед проверкой РПН — PDF одной кнопкой.",
              metric: "≈15 ч/мес",
              metricLabel: "экономия времени",
            },
            {
              title: "Школьная столовая",
              before:
                "9 бумажных журналов, директор переписывает их перед каждым визитом надзора.",
              after:
                "Все журналы в одном кабинете. Повара заполняют с планшета, директор — отчёт по расписанию.",
              metric: "0 замечаний",
              metricLabel: "при последних проверках",
            },
            {
              title: "Пекарня с прослеживаемостью",
              before:
                "Партии муки и заквасок учитываются в Excel-таблице, при претензии непонятно от какого поставщика дефект.",
              after:
                "Каждая партия в lot-tracking, история от поставщика до полки доступна за 2 клика.",
              metric: "100% lot-coverage",
              metricLabel: "после 2 недель",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
            >
              <div className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#0b1024]">
                {c.title}
              </div>
              <div className="mt-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a13a32]">
                  Было
                </div>
                <p className="mt-1 text-[13px] leading-[1.55] text-[#6f7282]">
                  {c.before}
                </p>
              </div>
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Стало
                </div>
                <p className="mt-1 text-[13px] leading-[1.55] text-[#0b1024]">
                  {c.after}
                </p>
              </div>
              <div className="mt-5 rounded-2xl bg-[#f5f6ff] p-4">
                <div className="text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[#3848c7]">
                  {c.metric}
                </div>
                <div className="text-[12px] text-[#6f7282]">
                  {c.metricLabel}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-[12px] text-[#9b9fb3]">
          * Это типичные сценарии, а не реальные клиенты. Брендированные
          кейс-стади появятся, когда подписанные клиенты дадут разрешение на
          показ.
        </div>
      </section>

      {/* AUDIENCE */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            Кому полезно
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            WeSetup подойдёт, если у вас…
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {AUDIENCE.map((a) => (
            <div
              key={a.title}
              className="flex items-start gap-4 rounded-2xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
                <a.icon className="size-5" />
              </div>
              <div>
                <div className="text-[15px] font-semibold leading-tight text-[#0b1024]">
                  {a.title}
                </div>
                <p className="mt-1 text-[13px] leading-[1.55] text-[#6f7282]">
                  {a.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PARTNERSHIP */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-white px-5 py-8 sm:px-8 sm:py-10 md:px-12">
          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
                <Handshake className="size-6" />
              </div>
              <div className="max-w-[620px]">
                <h3 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
                  Работаете с общепитом? Станьте партнёром.
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-[#6f7282]">
                  Консалтинг по ХАССП, интеграторы учётных систем, поставщики
                  оборудования — расскажем, как подключить ваших клиентов и
                  зарабатывать на продлениях.
                </p>
              </div>
            </div>
            <a
              href="https://t.me/wesetupbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-5 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
            >
              Написать в Telegram
              <ArrowRight className="size-4 text-[#5566f6]" />
            </a>
          </div>
        </div>
      </section>

      {/* C10 — синтетическое «видео»: auto-playing цикличная анимация
          планшета с заполнением журнала. Замена реальной съёмки повара
          на кухне до тех пор, пока не появится исходник. */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
              <Smartphone className="size-4" />
              30 секунд на смену
            </div>
            <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
              Так выглядит заполнение журнала на планшете
            </h2>
            <p className="mt-4 text-[15px] leading-[1.6] text-[#6f7282]">
              Повар приходит на смену, открывает планшет на кухне, выбирает
              журнал, вписывает значение, нажимает «Сохранить». Запись
              автоматически подписывается логином сотрудника и попадает в
              PDF для проверки. Никаких бумажек, никаких «забыл расписаться».
            </p>
            <ul className="mt-5 space-y-2 text-[14px] text-[#3c4053]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  Автоматическая отметка «в норме / отклонение» по СанПиН
                  диапазону
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  Время заполнения подставляется само — не переписать задним
                  числом
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  Автозаполнение «как вчера» для постоянных значений
                </span>
              </li>
            </ul>
          </div>
          <JournalAutoplayVideo />
        </div>
      </section>

      {/* MOBILE + TELEGRAM SCREENSHOTS — placeholder carousel */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            <Smartphone className="size-4" />
            Мобильный доступ
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Журналы с планшета повара и бота в Telegram
          </h2>
          <p className="mt-4 text-[15px] text-[#6f7282]">
            Повар заполняет на планшете прямо в цехе, управляющий видит
            статус в Telegram, руководитель — полную картину на компьютере.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Smartphone,
              label: "Планшет на кухне",
              caption: "Гигиена / температура в один тап",
              accent: "from-[#eef1ff] to-[#dde2ff]",
              ring: "ring-[#5566f6]/30",
              iconColor: "text-[#5566f6]",
              mock: (
                <div className="space-y-1.5">
                  <div className="rounded-lg bg-white px-2 py-1.5 text-[10px] shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0b1024]">
                        Гигиена · 29.04
                      </span>
                      <span className="rounded-full bg-emerald-100 px-1.5 text-[8px] text-emerald-700">
                        ✓
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1.5 text-[10px] shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0b1024]">
                        Темп. -18°C
                      </span>
                      <span className="rounded-full bg-emerald-100 px-1.5 text-[8px] text-emerald-700">
                        OK
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] shadow-sm">
                    <span className="font-semibold text-rose-700">
                      Уборка · ждёт ↺
                    </span>
                  </div>
                </div>
              ),
            },
            {
              icon: Send,
              label: "Telegram-бот",
              caption: "Напоминания и алерты о нарушениях",
              accent: "from-[#dbeafe] to-[#c5d4fb]",
              ring: "ring-blue-400/30",
              iconColor: "text-blue-600",
              mock: (
                <div className="space-y-2">
                  <div className="rounded-2xl rounded-bl-sm bg-white px-2 py-1.5 text-[10px] shadow-sm">
                    🔔 Иванов не заполнил гигиену до 12:00
                  </div>
                  <div className="self-end rounded-2xl rounded-br-sm bg-blue-500 px-2 py-1.5 text-[10px] text-white shadow-sm">
                    Заполнить
                  </div>
                  <div className="rounded-2xl rounded-bl-sm bg-white px-2 py-1.5 text-[10px] shadow-sm">
                    📊 На неделе: 95% журналов закрыты
                  </div>
                </div>
              ),
            },
            {
              icon: ImageIcon,
              label: "Компьютер руководителя",
              caption: "Отчёты и PDF для Роспотребнадзора",
              accent: "from-[#fef3c7] to-[#fde68a]",
              ring: "ring-amber-400/30",
              iconColor: "text-amber-600",
              mock: (
                <div className="space-y-1.5">
                  <div className="rounded-lg bg-white px-2 py-2 text-[10px] shadow-sm">
                    <div className="font-semibold text-[#0b1024]">
                      Сводка за неделю
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <div className="rounded bg-emerald-50 px-1 text-emerald-700">
                        ✓ 95%
                      </div>
                      <div className="rounded bg-amber-50 px-1 text-amber-700">
                        ⚠ 3
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-2 py-1.5 text-[10px] shadow-sm">
                    📄 Скачать PDF за апрель
                  </div>
                </div>
              ),
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`group flex aspect-[3/4] flex-col rounded-3xl bg-gradient-to-br ${item.accent} p-5 ring-1 ${item.ring} transition-transform hover:-translate-y-1`}
            >
              <div
                className={`flex size-12 items-center justify-center rounded-2xl bg-white/80 ${item.iconColor} backdrop-blur shadow-[0_0_0_1px_rgba(220,223,237,0.5)]`}
              >
                <item.icon className="size-6" />
              </div>
              <div className="mt-4 text-[15px] font-semibold text-[#0b1024]">
                {item.label}
              </div>
              <div className="mt-1 text-[12px] text-[#3c4053]">
                {item.caption}
              </div>
              <div className="mt-auto flex flex-col">{item.mock}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CLIENTS section убрана — реальных логотипов пока нет, лучше */}
      {/* пустого грязного блока (UX 2026-04-30). Вернётся когда */}
      {/* появятся подписанные клиенты с разрешением показа. */}

      {/* TESTIMONIALS section убрана — без реальных отзывов. */}
      {/* Вернётся когда появятся клиенты, готовые подписать кейс. */}

      {/* C5 — final reorder: FAQ → BLOG → CTA (recommended pattern). */}

      {/* FAQ */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="mb-10 max-w-[640px]">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            <HelpCircle className="size-4" />
            Вопросы и ответы
          </div>
          <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
            Быстрая справка перед регистрацией
          </h2>
        </div>
        <div className="divide-y divide-[#ececf4] overflow-hidden rounded-2xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-[16px] font-medium text-[#0b1024] hover:bg-[#fafbff]">
                <span>{item.q}</span>
                <span className="flex size-7 items-center justify-center rounded-full bg-[#f5f6ff] text-[#5566f6] transition-transform group-open:rotate-45">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 text-[14px] leading-[1.6] text-[#6f7282]">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* BLOG */}
      {latestArticles.length > 0 && (
        <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-[640px]">
              <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
                <NotebookText className="size-4" />
                Блог
              </div>
              <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
                Как вести журналы и проходить проверки
              </h2>
              <p className="mt-4 text-[15px] text-[#6f7282]">
                Разборы норм, чек-листы и истории клиентов. Короткие тексты —
                читать можно в перерыве между заготовками.
              </p>
            </div>
            <Link
              href="/blog"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
            >
              Все статьи
              <ArrowRight className="size-4 text-[#5566f6]" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {latestArticles.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="group flex flex-col rounded-3xl border border-[#ececf4] bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[#5566f6]/40 hover:shadow-[0_20px_50px_-30px_rgba(85,102,246,0.35)]"
              >
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6f7282]">
                  {a.tags.slice(0, 2).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[#3848c7]"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {a.readMinutes} мин
                  </span>
                </div>
                <h3 className="mt-4 text-[19px] font-semibold leading-snug tracking-[-0.01em] text-[#0b1024] group-hover:text-[#3848c7]">
                  {a.title}
                </h3>
                <p className="mt-3 line-clamp-3 flex-1 text-[14px] leading-[1.6] text-[#6f7282]">
                  {a.excerpt}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[#3848c7]">
                  Читать
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 pb-20">
        <div className="rounded-3xl border border-[#ececf4] bg-[#f5f6ff] p-6 text-center sm:p-10 md:p-14">
          <div className="mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-[#5566f6] text-white shadow-[0_14px_36px_-14px_rgba(85,102,246,0.6)]">
            <Sparkles className="size-7" />
          </div>
          <h3 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em] text-[#0b1024]">
            Готовы избавиться от бумаги?
          </h3>
          <p className="mx-auto mt-3 max-w-[480px] text-[15px] leading-[1.55] text-[#6f7282]">
            Зарегистрируйте организацию за 3 шага и начните заполнять журналы
            уже сегодня. Бесплатный тариф — без срока, без карты.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {isAuthed ? (
              <Link
                href={homeHref}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0]"
              >
                Открыть кабинет
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0]"
                >
                  Начать бесплатно
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-6 text-[15px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-white"
                >
                  У меня уже есть аккаунт
                  <ArrowRight className="size-4 text-[#5566f6]" />
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <PublicFooter />
    </div>
  );
}

function PricingCard({
  kind,
  name,
  from,
  period,
  description,
  points,
  ctaLabel,
  ctaHref,
  highlighted,
  badge,
}: {
  kind: "free" | "team" | "network";
  name: string;
  from: string;
  period: string;
  description: string;
  points: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  badge?: string;
}) {
  const Icon =
    kind === "free" ? Gift : kind === "network" ? Building2 : Users;
  return (
    <div
      className={
        highlighted
          ? "relative overflow-hidden rounded-3xl bg-[#0b1024] p-5 text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)] sm:p-8"
          : "relative rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-8"
      }
    >
      {highlighted && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 size-[260px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -left-16 -bottom-10 size-[240px] rounded-full bg-[#7a5cff] opacity-30 blur-[120px]" />
        </div>
      )}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <span
            className={
              highlighted
                ? "flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20"
                : "flex size-11 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]"
            }
          >
            <Icon className="size-5" />
          </span>
          <div className="text-[20px] font-semibold tracking-[-0.01em]">
            {name}
          </div>
          {badge && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#7cf5c0]/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-[#7cf5c0]">
              {badge}
            </span>
          )}
        </div>
        <p
          className={
            highlighted
              ? "mt-4 text-[14px] leading-[1.55] text-white/70"
              : "mt-4 text-[14px] leading-[1.55] text-[#6f7282]"
          }
        >
          {description}
        </p>
        <div className="mt-6 flex items-baseline gap-2">
          <span className="text-[34px] font-semibold tracking-[-0.02em]">
            {from}
          </span>
          <span
            className={
              highlighted
                ? "text-[13px] text-white/60"
                : "text-[13px] text-[#9b9fb3]"
            }
          >
            {period}
          </span>
        </div>
        <ul
          className={
            highlighted
              ? "mt-6 space-y-2.5 text-[14px] text-white/85"
              : "mt-6 space-y-2.5 text-[14px] text-[#3c4053]"
          }
        >
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <CheckCircle2
                className={
                  highlighted
                    ? "mt-0.5 size-4 shrink-0 text-[#7cf5c0]"
                    : "mt-0.5 size-4 shrink-0 text-[#5566f6]"
                }
              />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className={
            highlighted
              ? "mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-medium text-[#0b1024] transition-colors hover:bg-white/90"
              : "mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[15px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
          }
        >
          {ctaLabel}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
