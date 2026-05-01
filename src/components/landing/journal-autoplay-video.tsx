"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ThermometerSnowflake } from "lucide-react";

/**
 * C10 — синтетическое «видео» 30-60 сек: auto-playing цикличная демонстрация
 * как заполняется журнал контроля температуры холодильника. Вместо реальной
 * съёмки повара на кухне (которой пока нет) — анимированный mockup в раме
 * планшета, который циклится. Визуально воспринимается как screen-recording.
 *
 * Один цикл = ~14 секунд:
 *   1. empty (1s) — пустая форма появляется
 *   2. typing-name (3s) — character-by-character печатается ФИО
 *   3. typing-temp (2s) — печатается температура
 *   4. press-button (1s) — кнопка подсвечивается
 *   5. success (3s) — success-экран с галочкой
 *   6. fade-out (1s) → возврат к шагу 1
 *
 * Реализация: useState для шага + setInterval для тика. Не CSS-only потому
 * что character-by-character typing хочется делать через state, не через
 * keyframes (которые не умеют typing-эффект чисто).
 */

const NAME = "Иванов И. И.";
const TEMP = "+4";

const STEPS = [
  { id: "empty", duration: 1500 },
  { id: "typing-name", duration: 2500 },
  { id: "typing-temp", duration: 1800 },
  { id: "press", duration: 900 },
  { id: "success", duration: 3000 },
  { id: "fade", duration: 1000 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function JournalAutoplayVideo() {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const step = STEPS[stepIndex];
    const startedAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / step.duration);
      setProgress(ratio);
      if (ratio >= 1) {
        setStepIndex((i) => (i + 1) % STEPS.length);
      }
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [stepIndex]);

  const step: StepId = STEPS[stepIndex].id;
  const typedName =
    step === "typing-name"
      ? NAME.slice(0, Math.ceil(NAME.length * progress))
      : step === "empty" || step === "fade"
        ? ""
        : NAME;
  const typedTemp =
    step === "typing-temp"
      ? TEMP.slice(0, Math.ceil(TEMP.length * progress))
      : step === "empty" ||
          step === "typing-name" ||
          step === "fade"
        ? ""
        : TEMP;
  const buttonHot = step === "press";
  const showSuccess = step === "success";
  const fadeOut = step === "fade";

  return (
    <div className="relative mx-auto max-w-[460px]">
      {/* Tablet bezel */}
      <div className="relative rounded-[36px] border border-[#0b1024]/15 bg-[#0b1024] p-3 shadow-[0_30px_80px_-30px_rgba(11,16,36,0.55)]">
        {/* Camera dot */}
        <div className="pointer-events-none absolute left-1/2 top-[14px] z-10 size-1.5 -translate-x-1/2 rounded-full bg-[#3c4053]" />
        {/* Screen */}
        <div
          className={`relative overflow-hidden rounded-[26px] bg-white transition-opacity duration-500 ${
            fadeOut ? "opacity-40" : "opacity-100"
          }`}
        >
          {/* Status bar */}
          <div className="flex items-center justify-between bg-[#fafbff] px-5 py-2 text-[11px] font-medium text-[#6f7282]">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              WeSetup
            </span>
          </div>

          {/* Form / Success */}
          <div className="px-5 pb-6 pt-4">
            {showSuccess ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div
                  className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition-transform duration-500"
                  style={{
                    transform: `scale(${0.5 + progress * 0.5})`,
                  }}
                >
                  <CheckCircle2 className="size-7" />
                </div>
                <div className="mt-4 text-[15px] font-semibold text-[#0b1024]">
                  Запись сохранена
                </div>
                <div className="mt-1 text-[12px] text-[#6f7282]">
                  {NAME} · {TEMP} °C
                </div>
                <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                  В норме (0 … +6 °C)
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5566f6]">
                    <ThermometerSnowflake className="size-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#9b9fb3]">
                      Журнал
                    </div>
                    <div className="text-[12px] font-semibold text-[#0b1024]">
                      Температура холодильника
                    </div>
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="text-[11px] font-medium text-[#0b1024]">
                    ФИО проверяющего
                  </span>
                  <div
                    className={`mt-1 flex h-9 items-center rounded-xl border px-3 text-[12px] ${
                      step === "typing-name"
                        ? "border-[#5566f6] ring-2 ring-[#5566f6]/15"
                        : "border-[#dcdfed]"
                    }`}
                  >
                    <span className={typedName ? "text-[#0b1024]" : "text-[#9b9fb3]"}>
                      {typedName || "Иванов И. И."}
                    </span>
                    {step === "typing-name" && (
                      <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-[#5566f6]" />
                    )}
                  </div>
                </label>

                <label className="mt-3 block">
                  <span className="text-[11px] font-medium text-[#0b1024]">
                    Температура, °C
                  </span>
                  <div
                    className={`mt-1 flex h-9 items-center rounded-xl border px-3 text-[12px] ${
                      step === "typing-temp"
                        ? "border-[#5566f6] ring-2 ring-[#5566f6]/15"
                        : "border-[#dcdfed]"
                    }`}
                  >
                    <span className={typedTemp ? "text-[#0b1024]" : "text-[#9b9fb3]"}>
                      {typedTemp || "+4"}
                    </span>
                    {step === "typing-temp" && (
                      <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-[#5566f6]" />
                    )}
                  </div>
                </label>

                <button
                  type="button"
                  disabled
                  className={`mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-semibold text-white transition-all ${
                    buttonHot
                      ? "bg-[#4a5bf0] shadow-[0_10px_24px_-10px_rgba(85,102,246,0.7)] scale-[0.98]"
                      : typedTemp
                        ? "bg-[#5566f6] shadow-[0_8px_20px_-10px_rgba(85,102,246,0.5)]"
                        : "bg-[#dcdfed] text-[#9b9fb3]"
                  }`}
                >
                  Сохранить
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-[#9b9fb3]">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-rose-500" />
        Демо без звука · 14 сек цикл
      </div>
    </div>
  );
}
