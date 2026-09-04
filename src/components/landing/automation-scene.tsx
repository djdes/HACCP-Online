"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  BellRing,
  CheckCircle2,
  ScanLine,
  Thermometer,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand/logo";

/**
 * «Температура пишется сама» — компактная сцена автоматизации под hero.
 *
 * Один блок во всю ширину, три шага слева направо: датчик на дверце
 * холодильника меряет → показание летит по Wi-Fi в WeSetup → строка
 * журнала печатается сама. Между шагами — пунктир с бегущим «пакетом
 * данных» (на мобилке шаги встают в столбик со стрелками вниз).
 * Внизу блока — две строки-примечания: что происходит при отклонении
 * (сообщение ответственному, затем руководству) и что сканер на
 * приёмке работает так же. Оба сюжета важны, но как четвёртый и
 * пятый шаг ряда они не читались.
 *
 * Датчик нарисован вектором — тот, который мы ставим клиентам: круглое
 * чёрное табло в металлическом ободе, красные сегментные цифры, щуп на
 * проводе. Фотографии здесь нет намеренно: раньше страница ждала файл
 * `public/landing/tuya-sensor.png`, его не было, и до гидратации на
 * проде висел значок битой картинки.
 *
 * Клиентский компонент нужен ровно для одного: прочитать
 * `prefers-reduced-motion` и отрисовать финальное состояние сцены
 * (заполненная строка + галочка) без анимаций. Сама анимация — CSS
 * keyframes в globals.css (`automation-*`), как и у остального лендинга.
 */

/** Значения, между которыми «тикает» датчик. */
const TEMP_VALUES = ["+2.6", "+2.8", "+3.1"];

/** Уже заполненные строки журнала температуры. */
const FILLED_ROWS = [
  { time: "06:00", value: "+3.0" },
  { time: "10:00", value: "+2.9" },
  { time: "14:00", value: "+3.1" },
];

const STEPS = [
  {
    eyebrow: "Холодильник №3",
    title: "Датчик меряет сам",
    hint: "Каждые 10 минут, руками ничего не пишут.",
  },
  {
    eyebrow: "Wi-Fi",
    title: "Показание летит в WeSetup",
    hint: "С точным временем — задним числом не впишешь.",
  },
  {
    eyebrow: "Журнал температуры",
    /** На мобилке рядом с визуалом мало места — подпись короче. */
    eyebrowShort: "Журнал",
    title: "Строка появляется сама",
    hint: "Норма — зелёная галочка. Повар не отвлекается.",
  },
] as const;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return reduced;
}

export function AutomationScene() {
  const reduced = useReducedMotion();

  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-6">
      <ol className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-x-3">
        <Step n={1} {...STEPS[0]}>
          <TuyaSensor reduced={reduced} />
        </Step>
        <Connector reduced={reduced} />
        <Step n={2} {...STEPS[1]}>
          <CloudTile reduced={reduced} />
        </Step>
        <Connector reduced={reduced} />
        <Step n={3} {...STEPS[2]}>
          <JournalMini reduced={reduced} />
        </Step>
      </ol>

      <div className="mt-5 space-y-2.5 border-t border-[#eef0f6] pt-4 text-[13px] leading-[1.5] text-[#6f7282]">
        <FootNote icon={BellRing}>
          Вышло за норму — сообщение сразу{" "}
          <span className="font-medium text-[#0b1024]">
            ответственному за журнал
          </span>
          . Не исправил — узнает руководитель. Порог и само правило
          настраиваются.
        </FootNote>
        <FootNote icon={ScanLine}>
          Так же и на приёмке: сканер штрих-кода вписывает партию, срок
          годности и поставщика — ввод руками не нужен.
        </FootNote>
      </div>
    </div>
  );
}

/** Строка-примечание под шагами: иконка слева, текст в одну колонку. */
function FootNote({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-[#5566f6]" />
      <span>{children}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * Шаг: номер + подпись, визуал фиксированной высоты, пояснение
 * -------------------------------------------------------------------- */

function Step({
  n,
  eyebrow,
  eyebrowShort,
  title,
  hint,
  children,
}: {
  n: number;
  eyebrow: string;
  eyebrowShort?: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    // Мобилка: визуал слева, текст справа — шаг занимает одну строку.
    // md+: колонка «подпись → визуал → пояснение», порядок через order.
    <li className="grid grid-cols-[120px_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-4 md:flex md:min-w-0 md:flex-col md:items-stretch">
      <div className="col-start-2 row-start-1 self-end md:order-1 md:self-auto">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-[12px] font-semibold tabular-nums text-[#3848c7]">
            {n}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5566f6] md:tracking-[0.16em]">
            {eyebrowShort ? (
              <>
                <span className="md:hidden">{eyebrowShort}</span>
                <span className="hidden md:inline">{eyebrow}</span>
              </>
            ) : (
              eyebrow
            )}
          </span>
        </div>
        <div className="mt-1 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#0b1024] md:mt-1.5">
          {title}
        </div>
      </div>
      {/* Одна высота у всех трёх визуалов — иначе колонки «пляшут»,
          а соединители не попадают в их середину. */}
      <div className="col-start-1 row-span-2 row-start-1 flex h-[124px] items-center justify-center md:order-2 md:mt-3">
        {children}
      </div>
      <p className="col-start-2 row-start-2 mt-1.5 self-start text-[13px] leading-[1.5] text-[#6f7282] md:order-3 md:mt-3 md:self-auto">
        {hint}
      </p>
    </li>
  );
}

/* ----------------------------------------------------------------------
 * 1. Датчик температуры с Wi-Fi
 * -------------------------------------------------------------------- */

function TuyaSensor({ reduced }: { reduced: boolean }) {
  return (
    // Провод со щупом уходит вправо-вниз за пределы корпуса, поэтому
    // сам корпус сдвинут влево — так вся фигура стоит по центру шага.
    // На мобилке датчик чуть меньше, чтобы щуп не залезал на текст.
    <span
      aria-hidden="true"
      className="relative block -translate-x-2 scale-[0.8] md:-translate-x-5 md:scale-100"
    >
      {/* Провод щупа: уходит из-под корпуса вправо и вниз, как на
          реальном устройстве. Рисуем под корпусом, чтобы вход провода
          прятался за ободом. */}
      <svg
        viewBox="0 0 120 96"
        className="pointer-events-none absolute -bottom-6 -right-14 h-[96px] w-[120px]"
        fill="none"
      >
        <path
          d="M8 22 C 44 18, 66 34, 70 52 C 74 70, 58 82, 44 76 C 32 71, 36 56, 50 56 L 96 56"
          stroke="#1b1e28"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* металлический наконечник щупа */}
        <rect x="94" y="51.5" width="20" height="9" rx="4.5" fill="#c9cdd8" />
        <rect x="94" y="51.5" width="20" height="4" rx="2" fill="#e8eaf0" />
      </svg>

      {/* корпус: металлический обод + стеклянное табло */}
      <span className="relative flex size-[96px] items-center justify-center rounded-full bg-gradient-to-b from-[#f4f6fa] via-[#d5d9e3] to-[#a9aebc] p-[3px] shadow-[0_14px_30px_-14px_rgba(11,16,36,0.65)]">
        <span className="relative flex size-full flex-col items-center justify-center overflow-hidden rounded-full bg-[#111318]">
          {/* блик на стекле */}
          <span className="pointer-events-none absolute -left-4 -top-6 size-[70px] rounded-full bg-white/10 blur-[10px]" />

          <span className="relative text-[5.5px] font-medium leading-[1.35] tracking-[0.04em] text-white/55">
            Temperature
            <br />
            <span className="block text-center">detector</span>
          </span>

          <span className="relative mt-1 flex items-center gap-1">
            <Thermometer className="size-3 text-[#ff4b3e]" />
            <TempReadout reduced={reduced} variant="led" />
          </span>
        </span>
      </span>

      <WifiArcs reduced={reduced} />
    </span>
  );
}

function TempReadout({
  reduced,
  variant = "plain",
}: {
  reduced: boolean;
  /** `led` — красные цифры на чёрном табло датчика. */
  variant?: "plain" | "led";
}) {
  const cls =
    variant === "led"
      ? "text-[15px] font-semibold tabular-nums leading-none tracking-[0.02em] text-[#ff4b3e] [text-shadow:0_0_6px_rgba(255,75,62,0.55)]"
      : "text-[12px] font-semibold tabular-nums text-[#0b1024]";

  if (reduced) {
    return <span className={cls}>+2.8°</span>;
  }

  return (
    <span className={`relative grid ${cls}`}>
      {TEMP_VALUES.map((v, i) => (
        // Отрицательная задержка: анимация стартует сразу с нужной фазы,
        // без «до задержки» состояния, где все три значения видны разом.
        <span
          key={v}
          className="automation-temp col-start-1 row-start-1"
          style={{ animationDelay: `${i * 1.2 - 3.6}s` }}
        >
          {v}°
        </span>
      ))}
    </span>
  );
}

function WifiArcs({ reduced }: { reduced: boolean }) {
  return (
    <span className="pointer-events-none absolute -right-2 -top-3 flex size-6 items-end justify-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`absolute bottom-0 rounded-full border-2 border-b-transparent border-l-transparent border-r-transparent border-t-[#5566f6] ${
            reduced ? "opacity-60" : "automation-wifi"
          }`}
          style={{
            width: 8 + i * 7,
            height: 8 + i * 7,
            animationDelay: `${i * 0.28}s`,
          }}
        />
      ))}
    </span>
  );
}

/* ----------------------------------------------------------------------
 * 2. WeSetup принимает показание по Wi-Fi
 * -------------------------------------------------------------------- */

function CloudTile({ reduced }: { reduced: boolean }) {
  return (
    <div aria-hidden="true" className="flex flex-col items-center">
      <span className="relative flex size-[64px] items-center justify-center rounded-2xl bg-[#eef1ff] shadow-[0_16px_40px_-24px_rgba(85,102,246,0.35)]">
        <BrandMark size={36} className="rounded-[10px]" />
        <WifiArcs reduced={reduced} />
      </span>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[12px] font-medium text-[#3848c7]">
        <Wifi className="size-3.5" />
        <span className="tabular-nums">18:00 ·</span>
        <TempReadout reduced={reduced} />
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * 3. Журнал температуры — строка печатается сама
 * -------------------------------------------------------------------- */

function JournalMini({ reduced }: { reduced: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-[236px] overflow-hidden rounded-[10px] bg-white p-2.5 ring-1 ring-[#e3e6f2] shadow-[0_10px_28px_-16px_rgba(11,16,36,0.22)]"
    >
      <div className="text-center text-[7px] font-medium uppercase tracking-[0.12em] text-[#0b1024]">
        Журнал контроля температуры
      </div>
      <table className="mt-1.5 w-full border-collapse text-[#0b1024]">
        <thead>
          <tr>
            <th className="w-[34%] border border-[#0b1024] px-1 py-0.5 text-center text-[6px] font-normal text-[#1b3a8f]">
              Время
            </th>
            <th className="border border-[#0b1024] px-1 py-0.5 text-center text-[6px] font-normal text-[#1b3a8f]">
              Температура
            </th>
            <th className="w-[22%] border border-[#0b1024] px-1 py-0.5 text-center text-[6px] font-normal text-[#1b3a8f]">
              Норма
            </th>
          </tr>
        </thead>
        <tbody>
          {FILLED_ROWS.map((r) => (
            <tr key={r.time}>
              <td className="border border-[#0b1024] px-1 py-[3px] text-center text-[6px] tabular-nums">
                {r.time}
              </td>
              <td className="border border-[#0b1024] px-1 py-[3px] text-center text-[6px] tabular-nums">
                {r.value} °C
              </td>
              <td className="border border-[#0b1024] px-1 py-[3px] text-center text-[6px]">
                да
              </td>
            </tr>
          ))}
          <tr className="bg-[#f5f6ff]">
            <td className="border border-[#0b1024] px-1 py-[3px] text-center text-[6px] tabular-nums">
              18:00
            </td>
            <td className="border border-[#0b1024] px-1 py-[3px] text-center text-[6px] tabular-nums">
              <TypedValue reduced={reduced} />
            </td>
            <td className="border border-[#0b1024] px-1 py-[3px] text-center text-[6px]">
              <CheckCircle2
                className={`inline-block size-2.5 text-[#116b2a] ${
                  reduced ? "" : "automation-pop"
                }`}
                style={reduced ? undefined : { animationDelay: "2.2s" }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TypedValue({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return <span className="text-[#0b1024]">+2.8 °C</span>;
  }

  return (
    <span className="inline-flex items-center align-middle">
      <span className="automation-typed inline-block overflow-hidden whitespace-nowrap align-middle text-[#0b1024]">
        +2.8 °C
      </span>
      <span className="automation-caret ml-[1px] inline-block h-[7px] w-[1px] bg-[#5566f6] align-middle" />
    </span>
  );
}

/* ----------------------------------------------------------------------
 * Соединитель: пунктир с бегущей точкой (md+) / стрелка вниз (мобилка)
 * -------------------------------------------------------------------- */

function Connector({ reduced }: { reduced: boolean }) {
  return (
    // На мобилке стрелка стоит под колонкой визуалов (120px), а не по
    // центру карточки — так она продолжает поток «датчик → облако → журнал».
    <li
      aria-hidden="true"
      className="flex list-none justify-center py-1 md:w-[56px] md:self-center md:py-0 max-md:w-[120px]"
    >
      <ArrowDown
        className={`size-5 text-[#5566f6] md:hidden ${
          reduced ? "" : "automation-bounce"
        }`}
      />

      <div className="relative hidden w-full items-center md:flex">
        <svg className="h-6 w-full" role="presentation">
          <line
            x1="4"
            y1="12"
            x2="100%"
            y2="12"
            stroke="#c9cfe8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="5 6"
            className={reduced ? "" : "automation-dash"}
          />
        </svg>
        <span
          className={`absolute top-1/2 size-[7px] -translate-y-1/2 rounded-full bg-[#5566f6] shadow-[0_0_10px_2px_rgba(85,102,246,0.35)] ${
            reduced ? "left-1/2 -translate-x-1/2" : "automation-packet"
          }`}
        />
      </div>
    </li>
  );
}
