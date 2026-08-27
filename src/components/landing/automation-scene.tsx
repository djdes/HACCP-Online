"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  CheckCircle2,
  ScanLine,
  Thermometer,
} from "lucide-react";

/**
 * «Заполняется само» — сцена автоматизации сразу под hero.
 *
 * Три карточки: датчик на холодильнике → строка журнала печатается
 * сама → планшет со сканером закрывает партию. Между ними —
 * пунктирные линии с бегущим «пакетом данных».
 *
 * Клиентский компонент нужен ровно для одного: прочитать
 * `prefers-reduced-motion` и отрисовать финальное состояние сцены
 * (заполненная строка + галочка + строка партии) без анимаций.
 * Сама анимация — CSS keyframes в globals.css (`automation-*`),
 * как и весь остальной лендинг; framer-motion здесь не нужен.
 */

/** Значения, между которыми «тикает» датчик. */
const TEMP_VALUES = ["+2.6", "+2.8", "+3.1"];

/** Уже заполненные строки журнала температуры. */
const FILLED_ROWS = [
  { time: "06:00", value: "+3.0" },
  { time: "10:00", value: "+2.9" },
  { time: "14:00", value: "+3.1" },
];

/** Ширины полос штрих-кода — константа, чтобы не звать Math.random в рендере. */
const BARCODE_BARS = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 4, 2, 1, 3, 1, 2];

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
      <SensorCard reduced={reduced} />
      <Connector reduced={reduced} reverse={false} />
      <JournalCard reduced={reduced} />
      <Connector reduced={reduced} reverse />
      <ScannerCard reduced={reduced} />
    </div>
  );
}

/* ----------------------------------------------------------------------
 * Карточка-обёртка — общий визуальный язык с мокапами в hero
 * -------------------------------------------------------------------- */

function SceneCard({
  eyebrow,
  title,
  caption,
  children,
}: {
  eyebrow: string;
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5566f6]">
        {eyebrow}
      </div>
      <div className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em] text-[#0b1024]">
        {title}
      </div>
      <div className="mt-4 flex flex-1 items-center justify-center">
        {children}
      </div>
      <p className="mt-4 text-[13px] leading-[1.5] text-[#6f7282]">{caption}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------
 * 1. Холодильник с Wi-Fi датчиком
 * -------------------------------------------------------------------- */

function SensorCard({ reduced }: { reduced: boolean }) {
  return (
    <SceneCard
      eyebrow="Холодильник №3"
      title="Датчик на дверце"
      caption="Меряет температуру каждые 10 минут и отдаёт её по Wi-Fi. Никто ничего не записывает от руки."
    >
      <div
        aria-hidden="true"
        className="relative w-[136px] rounded-[22px] border border-[#dcdfed] bg-gradient-to-b from-[#fafbff] to-[#eef1ff] p-2 shadow-[0_16px_40px_-24px_rgba(85,102,246,0.35)]"
      >
        {/* морозильная камера */}
        <div className="relative h-[54px] rounded-[14px] border border-[#dcdfed] bg-white">
          <span className="absolute right-2 top-3 h-6 w-[3px] rounded-full bg-[#dcdfed]" />
        </div>

        {/* холодильная камера + бейдж-датчик */}
        <div className="relative mt-1.5 h-[104px] rounded-[14px] border border-[#dcdfed] bg-white">
          <span className="absolute right-2 top-3 h-9 w-[3px] rounded-full bg-[#dcdfed]" />

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative inline-flex items-center gap-1.5 rounded-full border border-[#dcdfed] bg-white px-2.5 py-1 shadow-[0_10px_24px_-16px_rgba(11,16,36,0.45)]">
              <Thermometer className="size-3.5 text-[#5566f6]" />
              <TempReadout reduced={reduced} />
              <WifiArcs reduced={reduced} />
            </div>
          </div>
        </div>
      </div>
    </SceneCard>
  );
}

function TempReadout({ reduced }: { reduced: boolean }) {
  if (reduced) {
    return (
      <span className="text-[12px] font-semibold tabular-nums text-[#0b1024]">
        +2.8°
      </span>
    );
  }

  return (
    <span className="relative grid text-[12px] font-semibold tabular-nums text-[#0b1024]">
      {TEMP_VALUES.map((v, i) => (
        <span
          key={v}
          className="automation-temp col-start-1 row-start-1"
          style={{ animationDelay: `${i * 1.2}s` }}
        >
          {v}°
        </span>
      ))}
    </span>
  );
}

function WifiArcs({ reduced }: { reduced: boolean }) {
  return (
    <span className="pointer-events-none absolute -right-1 -top-4 flex size-6 items-end justify-center">
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
 * 2. Журнал температуры — строка печатается сама
 * -------------------------------------------------------------------- */

function JournalCard({ reduced }: { reduced: boolean }) {
  return (
    <SceneCard
      eyebrow="Журнал температуры"
      title="Строка появляется сама"
      caption="Показание приходит в журнал с точным временем. Повар не отвлекается, а запись уже есть."
    >
      <div className="w-full">
        <div
          aria-hidden="true"
          className="overflow-hidden rounded-[10px] bg-white p-2.5 ring-1 ring-[#e3e6f2] shadow-[0_10px_28px_-16px_rgba(11,16,36,0.22)]"
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
                    className={`inline-block size-2.5 text-[#7cf5c0] ${
                      reduced ? "" : "automation-pop"
                    }`}
                    style={reduced ? undefined : { animationDelay: "2.2s" }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[12px] font-medium text-[#3848c7]">
            <CheckCircle2 className="size-3.5" />
            Без участия повара
          </span>
        </div>
      </div>
    </SceneCard>
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
 * 3. Планшет со сканером штрих-кодов
 * -------------------------------------------------------------------- */

function ScannerCard({ reduced }: { reduced: boolean }) {
  return (
    <SceneCard
      eyebrow="Приёмка и партии"
      title="Планшет со сканером"
      caption="Пикнули штрих-код — партия, срок годности и поставщик уже в журнале. Ввод руками не нужен."
    >
      <div
        aria-hidden="true"
        className="mx-auto w-[176px] rounded-[22px] border-[6px] border-[#0b1024] bg-[#0b1024] shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]"
      >
        <div className="rounded-[16px] bg-white p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-md bg-[#eef1ff] text-[#5566f6]">
              <ScanLine className="size-3" />
            </span>
            <span className="text-[9px] font-semibold text-[#0b1024]">
              Сканер партий
            </span>
          </div>

          {/* штрих-код + бегущий луч */}
          <div className="relative mt-2 overflow-hidden rounded-lg border border-[#ececf4] bg-[#fafbff] px-2 py-2.5">
            <div className="flex h-9 items-end justify-center gap-[2px]">
              {BARCODE_BARS.map((w, i) => (
                <span
                  key={i}
                  className="h-full rounded-[1px] bg-[#0b1024]"
                  style={{ width: w }}
                />
              ))}
            </div>
            <span
              className={`pointer-events-none absolute inset-x-1.5 h-[2px] rounded-full bg-[#f2545b] shadow-[0_0_10px_2px_rgba(242,84,91,0.45)] ${
                reduced ? "top-1/2 opacity-0" : "automation-beam"
              }`}
            />
          </div>

          <div className="mt-1.5 text-center text-[8px] tabular-nums text-[#9b9fb3]">
            4 601234 567890
          </div>

          <div
            className={`mt-2 flex items-center gap-1.5 rounded-lg bg-[#f5f6ff] px-2 py-1.5 ${
              reduced ? "" : "automation-pop"
            }`}
            style={reduced ? undefined : { animationDelay: "3.2s" }}
          >
            <CheckCircle2 className="size-3 shrink-0 text-[#116b2a]" />
            <span className="text-[8px] font-medium leading-tight text-[#0b1024]">
              Партия #1042 · Куриное филе
            </span>
          </div>
        </div>
      </div>
    </SceneCard>
  );
}

/* ----------------------------------------------------------------------
 * Соединитель: пунктир с бегущей точкой (sm+) / стрелка вниз (мобилка)
 * -------------------------------------------------------------------- */

function Connector({
  reduced,
  reverse,
}: {
  reduced: boolean;
  reverse: boolean;
}) {
  const packetClass = reverse ? "automation-packet-rev" : "automation-packet";

  return (
    <>
      <div className="flex justify-center py-1 sm:hidden" aria-hidden="true">
        <ArrowDown
          className={`size-5 text-[#5566f6] ${
            reduced ? "" : "automation-bounce"
          }`}
        />
      </div>

      <div
        className="relative hidden w-[64px] shrink-0 items-center sm:flex"
        aria-hidden="true"
      >
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
            reduced ? "left-1/2 -translate-x-1/2" : packetClass
          }`}
        />
      </div>
    </>
  );
}
