import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ShieldCheck,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public/public-chrome";
import { jsonLdSafeString } from "@/lib/json-ld";

/**
 * E17 — SEO-лендинги под ключевые поисковые запросы.
 *   /zhurnal-haccp                → «журнал ХАССП скачать»
 *   /zhurnal-zdorovya             → «журнал здоровья сотрудников общепит»
 *   /elektronnyy-zhurnal-sanpin   → «электронный журнал СанПиН»
 *   /brakerazhnyy-zhurnal         → «бракеражный журнал образец»
 *   /zhurnal-uborki               → «журнал уборки помещений скачать»
 *   /temperaturnyy-list-holodilnika → «температурный лист холодильника»
 *   /haccp-dlya-kafe              → «ХАССП для кафе»
 *
 * Все 7 страниц переиспользуют один компонент с разными prop'ами.
 */

export type SeoJournalConfig = {
  slug: string;
  hero: string;
  metaTitle: string;
  metaDescription: string;
  // 1-2 параграфа объясняющих что это за журнал
  intro: string;
  // что должен содержать журнал по СанПиН/ХАССП — для SEO content
  fields: ReadonlyArray<string>;
  // ключевая выгода WeSetup-альтернативы
  weSetupBenefit: string;
  // Связанный journalCode в каталоге (если применимо) — link
  // в /journals-info
  relatedCode?: string;
  // ссылка на скачивание pdf-шаблона (если есть)
  downloadHref?: string;
};

export function getSeoMetadata(c: SeoJournalConfig) {
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `https://wesetup.ru/${c.slug}` },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: `https://wesetup.ru/${c.slug}`,
    },
  };
}

export function SeoJournalLanding({ config }: { config: SeoJournalConfig }) {
  const c = config;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: c.metaTitle,
    description: c.metaDescription,
    url: `https://wesetup.ru/${c.slug}`,
    inLanguage: "ru-RU",
    isPartOf: { "@id": "https://wesetup.ru/#website" },
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafeString(jsonLd) }}
      />
      <PublicHeader />

      {/* HERO */}
      <section className="mx-auto max-w-[1100px] px-4 pt-10 sm:px-6 sm:pt-16">
        <div className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dcdfed] bg-[#fafbff] px-3 py-1 text-[12px] font-medium text-[#3848c7]">
            <ShieldCheck className="size-3.5" />
            СанПиН 2.3/2.4.3590-20 · Электронная форма разрешена
          </div>
          <h1 className="mt-5 max-w-[820px] text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[48px]">
            {c.hero}
          </h1>
          <p className="mt-5 max-w-[680px] text-[16px] leading-[1.6] text-[#3c4053] md:text-[18px]">
            {c.intro}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0]"
            >
              Вести этот журнал бесплатно
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {c.downloadHref ? (
              <a
                href={c.downloadHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-5 text-[15px] font-medium text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
              >
                <Download className="size-4" />
                Скачать шаблон PDF
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* FIELDS — что должно быть в журнале */}
      <section className="mx-auto max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 max-w-[640px]">
          <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            Что должно быть в журнале
          </div>
          <h2 className="text-[clamp(1.5rem,1.8vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
            Обязательные поля по СанПиН
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.fields.map((f) => (
            <div
              key={f}
              className="flex items-start gap-2 rounded-2xl border border-[#ececf4] bg-white p-4 text-[14px] leading-snug"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* WHY WESETUP */}
      <section className="mx-auto max-w-[1100px] px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-6 sm:p-10">
          <div className="mb-3 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
            Почему WeSetup
          </div>
          <h2 className="text-[clamp(1.5rem,1.8vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
            Электронный журнал — быстрее, безопаснее, без потерь
          </h2>
          <p className="mt-4 max-w-[700px] text-[15px] leading-[1.6] text-[#3c4053]">
            {c.weSetupBenefit}
          </p>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {[
              "Заполнение с планшета или из Telegram-бота — 30 секунд вместо 4 минут",
              "Автозаполнение «как вчера» — повар не пишет одно и то же каждый день",
              "PDF для проверок Роспотребнадзора — одна кнопка, шапки и подписи на месте",
              "Бэкапы каждые 6 часов — записи не пропадут, даже если разобьётся планшет",
            ].map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-[14px] leading-snug"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="group inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-semibold text-white hover:bg-[#4a5bf0]"
            >
              Начать бесплатно
              <ArrowRight className="size-4" />
            </Link>
            {c.relatedCode ? (
              <Link
                href={`/journals-info/${c.relatedCode}`}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
              >
                Подробно о журнале
                <ArrowRight className="size-4 text-[#5566f6]" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* RELATED — другие SEO-лендинги под смежные запросы. Cross-linking
          улучшает crawlability + помогает посетителю найти точное
          совпадение со своим запросом, если попал не туда. */}
      <section className="mx-auto max-w-[1100px] px-4 pb-14 sm:px-6 sm:pb-20">
        <div className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-6 sm:p-8">
          <div className="mb-5 text-[12px] uppercase tracking-[0.18em] text-[#6f7282]">
            Похожие журналы
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.values(SEO_LANDINGS)
              .filter((s) => s.slug !== c.slug)
              .slice(0, 6)
              .map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}`}
                  className="group flex items-start gap-3 rounded-2xl border border-[#ececf4] bg-white p-4 transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1 text-[13px] font-medium text-[#0b1024] group-hover:text-[#3848c7]">
                    {s.hero}
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-[#9b9fb3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
                </Link>
              ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export const SEO_LANDINGS: Record<string, SeoJournalConfig> = {
  "zhurnal-haccp": {
    slug: "zhurnal-haccp",
    hero: "Журнал ХАССП — электронный шаблон для общепита",
    metaTitle:
      "Журнал ХАССП скачать — электронный шаблон для общепита | WeSetup",
    metaDescription:
      "Электронный журнал ХАССП для кафе, ресторанов, столовых, пищевых производств. Бракераж, термообработка, контроль CCP, прослеживаемость. Бесплатный тариф до 5 сотрудников.",
    intro:
      "ХАССП-журналы фиксируют контрольные точки на пищевом производстве: приёмку сырья, термообработку, охлаждение, бракераж, обслуживание оборудования. По СанПиН 2.3/2.4.3590-20 их разрешено вести в электронном виде.",
    fields: [
      "Дата и время заполнения",
      "ФИО и должность ответственного",
      "Контролируемая точка (CCP) — что меряем",
      "Фактическое значение (температура, время, pH и т. д.)",
      "Допустимый диапазон по нормативу",
      "Корректирующее действие при отклонении",
      "Подпись (электронная)",
    ],
    weSetupBenefit:
      "В WeSetup ХАССП-журнал — это 11 связанных модулей: бракераж, термообработка, охлаждение, входной контроль сырья, прослеживаемость партий, поверка оборудования. Каждая запись подписывается автоматически логином сотрудника, при отклонении — push заведующему и автоматическое создание CAPA-тикета.",
    relatedCode: "finished_product",
  },
  "zhurnal-zdorovya": {
    slug: "zhurnal-zdorovya",
    hero: "Журнал здоровья сотрудников для общепита",
    metaTitle:
      "Журнал здоровья сотрудников общепит — электронный | WeSetup",
    metaDescription:
      "Электронный журнал здоровья сотрудников по СанПиН 2.3/2.4.3590-20. Допуск к смене, отметки об отстранении, контроль медкнижек. Бесплатно до 5 сотрудников.",
    intro:
      "Журнал здоровья сотрудников ведётся ежедневно перед началом смены — заведующий или шеф-повар осматривает каждого сотрудника на предмет признаков заболевания и оформляет допуск к работе.",
    fields: [
      "ФИО сотрудника",
      "Дата и время осмотра",
      "Допущен / не допущен",
      "Причина при недопуске (температура, ОРВИ, кожные)",
      "ФИО проверяющего и подпись",
      "Срок действия медкнижки",
    ],
    weSetupBenefit:
      "Каждое утро повар получает push в Telegram «отметить здоровье» — заполняет за 5 секунд. Если сотрудник не допущен, автоматически создаётся событие, и вы видите кто сегодня не работает в дашборде. Медкнижки с истекающим сроком — отдельный виджет с напоминанием за 30 дней.",
    relatedCode: "health_check",
  },
  "elektronnyy-zhurnal-sanpin": {
    slug: "elektronnyy-zhurnal-sanpin",
    hero: "Электронный журнал СанПиН для общепита",
    metaTitle:
      "Электронный журнал СанПиН — все 35 журналов в одном кабинете | WeSetup",
    metaDescription:
      "Все обязательные журналы по СанПиН 2.3/2.4.3590-20 в электронном виде: гигиена, температура, бракераж, уборка, входной контроль. PDF для Роспотребнадзора. Бесплатно до 5 сотрудников.",
    intro:
      "СанПиН 2.3/2.4.3590-20 «Санитарно-эпидемиологические требования к организации общественного питания» с 1 января 2021 года прямо разрешает электронную форму ведения журналов. WeSetup — это все обязательные журналы в одном кабинете.",
    fields: [
      "Журнал гигиены сотрудников",
      "Журнал контроля температурного режима",
      "Журнал входного контроля сырья",
      "Журнал бракеража",
      "Журнал учёта дезинфицирующих средств",
      "Журнал уборки и проветривания помещений",
      "Журнал учёта аварий",
      "Журнал жалоб гостей",
    ],
    weSetupBenefit:
      "Регистрация — 5 минут, и ваша команда сразу видит свои журналы в Telegram-боте. Бесплатный тариф навсегда: до 5 сотрудников все 35 журналов включены, без привязки карты, без триал-периода.",
  },
  "brakerazhnyy-zhurnal": {
    slug: "brakerazhnyy-zhurnal",
    hero: "Бракеражный журнал — образец и электронная форма",
    metaTitle:
      "Бракеражный журнал образец — электронная форма для кафе | WeSetup",
    metaDescription:
      "Бракеражный журнал готовой пищевой продукции — электронный образец по СанПиН. Оценка органолептики, температура подачи, время. Подписи комиссии. Бесплатно.",
    intro:
      "Бракеражный журнал — обязательный документ для общепита. Каждое блюдо перед выдачей оценивается комиссией: цвет, запах, вкус, консистенция. Записи делаются перед каждой партией.",
    fields: [
      "Дата и время бракеража",
      "Наименование блюда",
      "Органолептика: цвет, запах, вкус, консистенция",
      "Температура подачи",
      "Допущено / отклонено",
      "ФИО и подписи комиссии (минимум 3 человека)",
    ],
    weSetupBenefit:
      "Бракераж в WeSetup — три тапа в Telegram-боте на каждое блюдо. Комиссия (шеф + су-шеф + менеджер) подписывает совместно через свои аккаунты. Если блюдо отклонено — автоматический акт списания и расследование причин.",
    relatedCode: "finished_product",
  },
  "zhurnal-uborki": {
    slug: "zhurnal-uborki",
    hero: "Журнал уборки помещений — электронный шаблон",
    metaTitle:
      "Журнал уборки помещений скачать — электронная форма | WeSetup",
    metaDescription:
      "Журнал учёта уборки производственных помещений по СанПиН. Шаблон + электронная форма. Уборщица отмечает в Telegram, заведующая видит сводку. Бесплатно до 5 сотрудников.",
    intro:
      "Журнал уборки фиксирует: какое помещение, когда, кем убрано, какое использовалось средство. Должен заполняться ежедневно — это один из главных документов для проверки Роспотребнадзором.",
    fields: [
      "Дата и время уборки",
      "Наименование помещения",
      "Тип уборки (влажная, генеральная, дезинфекция)",
      "Использованное средство и концентрация",
      "ФИО уборщицы",
      "Подпись контролирующего лица (заведующая)",
    ],
    weSetupBenefit:
      "Каждой уборщице утром приходит свой список помещений в Telegram. Закончила цех — поставила галочку в боте. Заведующая в конце смены видит «убрано 12 из 12 помещений» и одной кнопкой подтверждает.",
    relatedCode: "cleaning",
  },
  "temperaturnyy-list-holodilnika": {
    slug: "temperaturnyy-list-holodilnika",
    hero: "Температурный лист холодильника — электронная форма",
    metaTitle:
      "Температурный лист холодильника — электронный журнал | WeSetup",
    metaDescription:
      "Температурный лист (журнал) холодильного оборудования по СанПиН. Утром и вечером — фиксация температуры. С IoT-датчиками — автозаполнение. Бесплатный тариф.",
    intro:
      "Температура холодильников и морозильных камер фиксируется минимум дважды в день — утром и вечером. Допустимый диапазон: холодильники +2…+6°C, морозилки -18°C и ниже. При отклонении — корректирующее действие.",
    fields: [
      "Наименование холодильника / морозилки",
      "Дата и время замера",
      "Фактическая температура",
      "Допустимый диапазон",
      "ФИО ответственного",
      "Корректирующее действие при отклонении",
    ],
    weSetupBenefit:
      "С IoT-датчиками от WeSetup журнал заполняется сам — каждые 15 минут. Если температура вышла за пределы — push заведующему и автоматический CAPA-тикет с фотографией графика. Без датчиков — повар отмечает в боте 2 раза в день, занимает 30 секунд.",
    relatedCode: "cold_equipment_control",
  },
  "haccp-dlya-kafe": {
    slug: "haccp-dlya-kafe",
    hero: "ХАССП для кафе — внедрение за 1 день",
    metaTitle:
      "ХАССП для кафе — внедрение и журналы под ключ | WeSetup",
    metaDescription:
      "ХАССП для кафе и ресторанов: блок-схемы, контрольные точки, обязательные журналы, обучение команды. Электронные журналы СанПиН. Бесплатный тариф до 5 сотрудников.",
    intro:
      "ХАССП — обязательная система контроля для общепита по ТР ТС 021/2011. WeSetup закрывает весь цикл: блок-схему, идентификацию опасностей, критические контрольные точки (CCP), мониторинг и корректирующие действия.",
    fields: [
      "Блок-схема технологического процесса",
      "Анализ опасностей (биологических, химических, физических)",
      "Идентификация CCP — критических контрольных точек",
      "Мониторинг CCP (термообработка, охлаждение, бракераж)",
      "Корректирующие действия при отклонении (CAPA)",
      "Внутренние аудиты раз в год",
      "Обучение персонала и протоколы",
    ],
    weSetupBenefit:
      "В WeSetup ХАССП готов из коробки — все 11 связанных журналов: термообработка (CCP), интенсивное охлаждение (CCP), входной контроль, бракераж, поверка оборудования, аудиты, CAPA-тикеты. Не нужно нанимать консультанта на 50 тысяч — настройка за 30 минут.",
    relatedCode: "audit_plan",
  },
};
