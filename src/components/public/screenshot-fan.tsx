import {
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageSquare,
  Snowflake,
  Send,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { AutoCarousel } from "@/components/landing/auto-carousel";

/**
 * Three stacked/tilted mockups showing the product surfaces: a desktop
 * dashboard in the centre, a phone with the Telegram bot on the left,
 * and a phone with the PDF export on the right.
 *
 * Everything is rendered as styled divs — no external images. That
 * keeps the hero blazing fast (one more image = one more LCP hit) and
 * sidesteps the «stock photo of a chef pointing at a laptop» cliché.
 * Content is stylised miniature UI: the proportions and typography
 * read as «it's our app», not «it's a random chart».
 */
export function ScreenshotFan() {
  return (
    <>
      {/* ДЕСКТОП: веер — дашборд по центру, телефон с ботом слева,
          лист А4 справа. Абсолютное позиционирование, потому что
          карточки намеренно перекрываются и наклонены. */}
      <div className="absolute inset-0 hidden sm:block">
        <div className="absolute left-1/2 top-0 w-[min(700px,100%)] -translate-x-1/2">
          <DesktopMockup />
        </div>

        <div className="absolute bottom-0 left-[2%] w-[min(210px,21vw)] -rotate-[8deg] md:left-[5%] md:w-[228px]">
          <TelegramMockup />
        </div>

        {/* Лист А4 — справа и крупнее телефона: это главный аргумент
            секции, инспектору отдают именно его. */}
        <div className="absolute bottom-0 right-[1%] w-[min(250px,24vw)] rotate-[6deg] md:right-[4%] md:w-[268px]">
          <A4SheetMockup />
        </div>
      </div>

      {/* ТЕЛЕФОН: та же карусель, что в «Подходит для» — центральный
          мокап активен и крупнее, соседние приглушены, снизу точки и
          стрелки. Раньше здесь был голый scroll-snap-ряд: карточки
          разной высоты не выравнивались, подпись уезжала за край, а
          понять, что ряд листается, было неоткуда. */}
      <div className="sm:hidden">
        <AutoCarousel
          ariaLabel="Как выглядит WeSetup"
          slideClassName="flex-[0_0_74%]"
          autoplayMs={6500}
          items={[
            <MobileSlide key="a4" caption="Бланк для проверки" widthClass="w-[228px]">
              <A4SheetMockup />
            </MobileSlide>,
            <MobileSlide key="bot" caption="Бот для смены" widthClass="w-[152px]">
              <TelegramMockup />
            </MobileSlide>,
            <MobileSlide key="app" caption="Кабинет" widthClass="w-full">
              <DesktopMockup />
            </MobileSlide>,
          ]}
        />
      </div>
    </>
  );
}

/**
 * Слайд мобильной карусели. Высота фиксирована и одинакова для всех
 * трёх: лист 1:1.414, телефон 9:19 и окно браузера сами по себе дают
 * разную высоту, и без общей коробки карусель прыгала на каждом
 * пролистывании. Мокап вписывается по высоте и центрируется.
 */
function MobileSlide({
  children,
  caption,
  widthClass,
}: {
  children: React.ReactNode;
  caption: string;
  /// Ширина подобрана под общую высоту: у листа 1:1.414, у телефона
  /// 9:19 — при одинаковой ширине они разъезжались бы вдвое.
  widthClass: string;
}) {
  return (
    <figure className="flex h-[368px] flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className={widthClass}>{children}</div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] font-medium text-[#6f7282]">
        {caption}
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------------------------
 * Desktop dashboard mockup
 * -------------------------------------------------------------------- */

function DesktopMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ececf4] bg-white shadow-[0_40px_80px_-30px_rgba(11,16,36,0.25),0_0_0_1px_rgba(240,240,250,0.7)]">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-[#ececf4] bg-[#fafbff] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff6059]" />
        <span className="size-2.5 rounded-full bg-[#ffbe2f]" />
        <span className="size-2.5 rounded-full bg-[#29d153]" />
        <div className="ml-4 flex h-6 flex-1 items-center rounded-full bg-white px-3 text-[11px] text-[#9b9fb3]">
          wesetup.ru/dashboard
        </div>
      </div>
      {/* app chrome */}
      <div className="flex items-center justify-between border-b border-[#ececf4] bg-white px-5 py-3">
        <div className="flex items-center gap-6">
          <div className="text-[#0b1024]">
            <BrandLogo height={22} title="" />
          </div>
          <div className="flex gap-4 text-[12px] font-medium text-[#6f7282]">
            <span className="text-[#0b1024]">Дашборд</span>
            <span>Журналы</span>
            <span>Сотрудники</span>
            <span>Отчёты</span>
          </div>
        </div>
        <div className="flex size-7 items-center justify-center rounded-full bg-[#eef1ff] text-[10px] font-semibold text-[#3848c7]">
          ДВ
        </div>
      </div>
      {/* body */}
      <div className="grid gap-3 bg-[#fafbff] p-5 md:grid-cols-[1.2fr_1fr]">
        {/* left: journals list */}
        <div className="rounded-xl border border-[#ececf4] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[12px] font-semibold text-[#0b1024]">
              Сегодня незаполнено
            </div>
            <span className="rounded-full bg-[#fff4f2] px-2 py-0.5 text-[10px] font-medium text-[#a13a32]">
              3
            </span>
          </div>
          <ul className="space-y-2">
            {[
              { name: "Гигиенический журнал", time: "09:00", done: true },
              { name: "Температура холодильников", time: "10:00", done: true },
              { name: "Бракераж готовой продукции", time: "12:00", done: false },
              { name: "Уборка зала", time: "18:00", done: false },
              { name: "Учёт фритюра", time: "20:00", done: false },
            ].map((r) => (
              <li
                key={r.name}
                className="flex items-center gap-3 rounded-lg bg-[#fafbff] px-3 py-2"
              >
                <CheckCircle2
                  className={`size-3.5 shrink-0 ${
                    r.done ? "text-[#5566f6]" : "text-[#dcdfed]"
                  }`}
                />
                <span className="text-[11px] font-medium text-[#0b1024]">
                  {r.name}
                </span>
                <span className="ml-auto text-[10px] text-[#9b9fb3]">
                  {r.time}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {/* right: chart card + stat card */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[#ececf4] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium text-[#6f7282]">
                Холодильник №3
              </div>
              <Snowflake className="size-3.5 text-[#5566f6]" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 text-[#0b1024]">
              <span className="text-[24px] font-semibold tabular-nums">
                +2.8
              </span>
              <span className="text-[11px] text-[#9b9fb3]">°C</span>
            </div>
            {/* mini chart */}
            <svg
              viewBox="0 0 200 50"
              className="mt-2 block h-[42px] w-full"
              fill="none"
              stroke="#5566f6"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              <path d="M0 30 L20 28 L40 32 L60 26 L80 30 L100 20 L120 24 L140 18 L160 22 L180 16 L200 20" />
              <path
                d="M0 30 L20 28 L40 32 L60 26 L80 30 L100 20 L120 24 L140 18 L160 22 L180 16 L200 20 L200 50 L0 50 Z"
                fill="url(#chartGrad)"
                stroke="none"
              />
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5566f6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#5566f6" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="rounded-xl border border-[#ececf4] bg-[#0b1024] p-4 text-white">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">
              CAPA открыто
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[22px] font-semibold tabular-nums">2</span>
              <span className="text-[10px] text-white/60">задачи</span>
            </div>
            <div className="mt-2 text-[11px] text-white/80">
              Температура витрины ↑ · Просрочка молочки
            </div>
          </div>
          <div className="rounded-xl border border-[#ececf4] bg-white p-4">
            <div className="flex items-center gap-2">
              <Users className="size-3.5 text-[#5566f6]" />
              <span className="text-[11px] font-medium text-[#6f7282]">
                На смене
              </span>
            </div>
            <div className="mt-1 text-[22px] font-semibold tabular-nums text-[#0b1024]">
              8
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * Telegram bot phone mockup
 * -------------------------------------------------------------------- */

function TelegramMockup() {
  return (
    // aspect-[9/19] locks this to a realistic phone ratio. Without it, the
    // inner chat content drives a tall natural height (~500 px for ~160 px
    // width), so on tablets the "веер" rendered as squished vertical
    // strips next to the desktop mockup — user feedback «телефоны в веере
    // вытянулись и стало некрасиво». `overflow-hidden` clips surplus chat
    // messages that don't fit inside the locked ratio.
    <div className="aspect-[9/19] overflow-hidden rounded-[34px] border-[6px] border-[#0b1024] bg-[#0b1024] shadow-[0_30px_60px_-20px_rgba(11,16,36,0.4)]">
      <div className="h-full rounded-[28px] bg-white">
        {/* header */}
        <div className="flex items-center gap-2 bg-[#4680c2] px-4 py-3 text-white">
          <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
            <Send className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold">
              @wesetupbot
            </div>
            <div className="text-[10px] text-white/70">в сети</div>
          </div>
        </div>
        {/* chat */}
        <div className="space-y-2 bg-[#eef3f8] p-3">
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 shadow-sm">
            <div className="text-[11px] font-semibold text-[#0b1024]">
              📋 Журналы
            </div>
            <div className="mt-1 text-[10px] leading-[1.4] text-[#6f7282]">
              Выберите журнал для заполнения:
            </div>
            <div className="mt-2 space-y-1.5">
              {["Гигиенический журнал", "Температура холодильников", "Уборка зала"].map(
                (t) => (
                  <div
                    key={t}
                    className="rounded-lg bg-[#eef1ff] px-2 py-1.5 text-[10px] font-medium text-[#3848c7]"
                  >
                    {t}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="ml-auto max-w-[60%] rounded-2xl rounded-br-sm bg-[#5566f6] px-3 py-2 text-[10px] text-white">
            Температура холодильников
          </div>

          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 shadow-sm">
            <div className="text-[10px] text-[#0b1024]">
              Холодильник №3 — введите значение температуры:
            </div>
          </div>

          <div className="ml-auto max-w-[40%] rounded-2xl rounded-br-sm bg-[#5566f6] px-3 py-2 text-[10px] text-white">
            +2.8
          </div>

          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 shadow-sm">
            <div className="text-[10px] font-medium text-[#116b2a]">
              ✅ Запись сохранена
            </div>
            <div className="mt-0.5 text-[10px] text-[#6f7282]">
              Видна на сайте мгновенно
            </div>
          </div>
        </div>
        {/* input */}
        <div className="flex items-center gap-2 border-t border-[#ececf4] bg-white px-3 py-2">
          <div className="flex-1 rounded-full bg-[#f5f6ff] px-3 py-1.5 text-[10px] text-[#9b9fb3]">
            Написать...
          </div>
          <div className="flex size-6 items-center justify-center rounded-full bg-[#5566f6]">
            <MessageSquare className="size-3 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * PDF export phone mockup
 * -------------------------------------------------------------------- */

/* ----------------------------------------------------------------------
 * A4 sheet mockup — «Журнал уборки»
 *
 * Заменил телефон с гигиеническим журналом. Посетитель лендинга — чаще
 * всего управляющая, которая держала в руках именно бумажный бланк:
 * лист А4 с шапкой ХАССП узнаётся мгновенно, а список фамилий на
 * телефоне — нет. Разметка статическая, «по мотивам» реального бланка,
 * а не рендер настоящего документа: это витрина, ей не нужен доступ
 * к чужим данным.
 * -------------------------------------------------------------------- */

const A4_ROOMS = [
  { name: "Горячий цех", marks: ["Т", "Т", "Г", "Т", "Т", "Т", "Т"] },
  { name: "Холодный цех", marks: ["Т", "Т", "Т", "Т", "Г", "Т", "Т"] },
  { name: "Моечная", marks: ["Т", "Г", "Т", "Т", "Т", "Т", "Г"] },
  { name: "Склад сухих продуктов", marks: ["Т", "Т", "Т", "Г", "Т", "Т", "Т"] },
  { name: "Зал", marks: ["Т", "Т", "Т", "Т", "Т", "Г", "Т"] },
];

const A4_DAYS = ["01", "02", "03", "04", "05", "06", "07"];

function A4SheetMockup() {
  return (
    <div className="aspect-[1/1.414] overflow-hidden rounded-[6px] bg-white p-[5%] shadow-[0_30px_60px_-20px_rgba(11,16,36,0.35)] ring-1 ring-[#e3e6f2]">
      {/* Шапка бланка: организация | система | учётные даты */}
      <div className="grid grid-cols-[1.3fr_1fr_1fr] border border-[#0b1024] text-[#0b1024]">
        <div className="border-r border-[#0b1024] px-2 py-1.5">
          <div className="text-[6px] uppercase tracking-[0.12em] text-[#6f7282]">
            Организация
          </div>
          <div className="mt-0.5 text-[8px] font-semibold leading-tight">
            ООО «Ромашка»
          </div>
        </div>
        <div className="flex items-center justify-center border-r border-[#0b1024] px-2 py-1.5 text-center text-[8px] font-semibold uppercase leading-tight tracking-[0.08em]">
          Система
          <br />
          ХАССП
        </div>
        <div className="px-2 py-1.5 text-[6px] leading-[1.5] text-[#3c4053]">
          <div>Начат: 01.04.2026</div>
          <div>Окончен: —</div>
          <div className="font-semibold text-[#0b1024]">СТР. 1 ИЗ 1</div>
        </div>
      </div>

      <div className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0b1024]">
        Журнал уборки и дезинфекции
      </div>

      {/* Сетка: помещения по строкам, дни по столбцам */}
      <table className="mt-2 w-full border-collapse text-[#0b1024]">
        <thead>
          <tr>
            <th className="border border-[#9aa0b8] bg-[#f4f5fa] px-1.5 py-1 text-left text-[6px] font-semibold uppercase tracking-[0.08em]">
              Помещение
            </th>
            {A4_DAYS.map((d) => (
              <th
                key={d}
                className="border border-[#9aa0b8] bg-[#f4f5fa] px-1 py-1 text-center text-[6px] font-semibold tabular-nums"
              >
                {d}
              </th>
            ))}
            <th className="border border-[#9aa0b8] bg-[#f4f5fa] px-1 py-1 text-center text-[6px] font-semibold uppercase">
              Средство
            </th>
          </tr>
        </thead>
        <tbody>
          {A4_ROOMS.map((room) => (
            <tr key={room.name}>
              <td className="border border-[#9aa0b8] px-1.5 py-[3px] text-[6.5px] leading-tight">
                {room.name}
              </td>
              {room.marks.map((m, i) => (
                <td
                  key={i}
                  className={`border border-[#9aa0b8] px-1 py-[3px] text-center text-[6.5px] font-semibold ${
                    m === "Г" ? "text-[#3848c7]" : "text-[#3c4053]"
                  }`}
                >
                  {m}
                </td>
              ))}
              <td className="border border-[#9aa0b8] px-1 py-[3px] text-center text-[6.5px] tabular-nums text-[#3c4053]">
                С1
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[5.5px] leading-relaxed text-[#6f7282]">
        <span>
          <b className="text-[#3c4053]">Т</b> — текущая уборка
        </span>
        <span>
          <b className="text-[#3848c7]">Г</b> — генеральная
        </span>
        <span>
          <b className="text-[#3c4053]">С1</b> — дезсредство, рабочий раствор
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#dcdfed] pt-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-1.5 py-0.5 text-[6px] font-medium text-[#116b2a]">
          <FileText className="size-2" />
          PDF для проверки
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#0b1024] px-2 py-1 text-[6.5px] font-medium text-white">
          Скачать для проверки
          <ArrowRight className="size-2" />
        </span>
      </div>
    </div>
  );
}
