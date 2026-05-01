"use client";

import { useState } from "react";
import { CheckCircle2, ThermometerSnowflake } from "lucide-react";

/**
 * C9 — interactive demo: позволяет посетителю «потрогать» форму журнала
 * без регистрации. Имитирует заполнение журнала контроля температуры
 * холодильника — один из самых частых ежедневных журналов общепита.
 *
 * Бэкенда нет: данные не сохраняются. После submit'а показываем экран
 * подтверждения + CTA «Создать аккаунт». Цель — снять страх «слишком
 * сложно» и показать реальный UX перед регистрацией.
 */
export function DemoJournalWidget() {
  const [step, setStep] = useState<"form" | "done">("form");
  const [name, setName] = useState("");
  const [temp, setTemp] = useState("");
  const [tempTouched, setTempTouched] = useState(false);

  const tempValue = Number(temp.replace(",", "."));
  const tempValid = !Number.isNaN(tempValue) && tempValue >= -30 && tempValue <= 30;
  const tempInRange = tempValid && tempValue >= 0 && tempValue <= 6;
  const formValid = name.trim().length >= 2 && tempValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    setStep("done");
  }

  function handleReset() {
    setName("");
    setTemp("");
    setTempTouched(false);
    setStep("form");
  }

  if (step === "done") {
    return (
      <div className="rounded-3xl border border-[#5566f6]/30 bg-gradient-to-br from-[#f5f6ff] to-white p-6 sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-7" />
        </div>
        <div className="mt-5 text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
          Запись сохранена
        </div>
        <div className="mt-2 text-[14px] text-[#6f7282]">
          {name.trim()} · {temp} °C ·{" "}
          {new Date().toLocaleString("ru-RU", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <p className="mt-4 text-[13px] leading-[1.6] text-[#6f7282]">
          Так же быстро в реальном WeSetup. Только запись попадёт в
          постоянный журнал, автоматически подпишется логином сотрудника
          и сохранится для PDF-выгрузки в Роспотребнадзор.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="/register"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] hover:bg-[#4a5bf0]"
          >
            Создать аккаунт бесплатно
          </a>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
          >
            Заполнить ещё раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-8"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
          <ThermometerSnowflake className="size-5" />
        </div>
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#9b9fb3]">
            Демо-журнал
          </div>
          <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]">
            Контроль температуры холодильника
          </div>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-[1.6] text-[#6f7282]">
        Один из самых частых журналов общепита. Заполняется ежедневно перед
        сменой. Заполните пример — данные не сохранятся, это просто демо.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[13px] font-medium text-[#0b1024]">
            ФИО проверяющего
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Иванов И. И."
            className="mt-1 h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-[#0b1024]">
            Температура, °C
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            onBlur={() => setTempTouched(true)}
            placeholder="+4"
            className={`mt-1 h-11 w-full rounded-2xl border bg-white px-4 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:outline-none focus:ring-4 ${
              tempTouched && temp && !tempValid
                ? "border-rose-300 focus:border-rose-400 focus:ring-rose-300/20"
                : "border-[#dcdfed] focus:border-[#5566f6] focus:ring-[#5566f6]/15"
            }`}
          />
          {tempTouched && temp && !tempValid && (
            <span className="mt-1 block text-[12px] text-rose-700">
              Введите температуру от −30 до +30 °C
            </span>
          )}
          {tempValid && !tempInRange && (
            <span className="mt-1 block text-[12px] text-amber-700">
              Норма для холодильника: 0 … +6 °C — в реальном журнале здесь
              автоматически появится отметка «отклонение».
            </span>
          )}
          {tempInRange && (
            <span className="mt-1 block text-[12px] text-emerald-700">
              В норме (0 … +6 °C)
            </span>
          )}
        </label>
      </div>

      <button
        type="submit"
        disabled={!formValid}
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#dcdfed] disabled:text-[#9b9fb3] disabled:shadow-none"
      >
        Сохранить запись
      </button>
      <span className="ml-3 text-[12px] text-[#9b9fb3]">
        Демо без сохранения
      </span>
    </form>
  );
}
