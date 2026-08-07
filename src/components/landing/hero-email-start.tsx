"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Стартовая форма лендинга: посетитель вводит почту прямо здесь и
 * попадает на регистрацию с уже заполненным полем.
 *
 * Валидация намеренно мягкая: пустое или явно не-почтовое значение не
 * блокирует переход, а просто уводит на /register без параметра.
 * Задача формы — снизить порог входа, а не отсеивать людей на первом
 * же шаге; настоящая проверка живёт в самой регистрации.
 */
export function HeroEmailStart({
  tone = "light",
  buttonLabel = "Начать бесплатно",
}: {
  /// "dark" — для размещения на тёмной секции (финальный CTA).
  tone?: "light" | "dark";
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const dark = tone === "dark";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    // Метрика: считаем именно старты с лендинга, чтобы отличать их от
    // прямых заходов на /register. Счётчик берём из той же переменной,
    // что и сам скрипт Метрики, — хардкодить номер нельзя.
    try {
      const counter = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID);
      if (Number.isFinite(counter) && counter > 0) {
        (
          window as unknown as {
            ym?: (id: number, action: string, goal: string) => void;
          }
        ).ym?.(counter, "reachGoal", "hero_email_submit");
      }
    } catch {
      /* метрика недоступна — не мешаем переходу */
    }
    router.push(
      value.includes("@")
        ? `/register?email=${encodeURIComponent(value)}`
        : "/register",
    );
  }

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <form
        onSubmit={submit}
        className="flex flex-col gap-2.5 sm:flex-row sm:gap-2"
      >
        <label htmlFor="hero-email" className="sr-only">
          Электронная почта
        </label>
        <input
          id="hero-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ваш e-mail"
          autoComplete="email"
          inputMode="email"
          className={
            "h-12 w-full flex-1 rounded-2xl border px-4 text-[15px] outline-none transition-colors focus:ring-4 sm:h-[56px] " +
            (dark
              ? "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/10"
              : "border-[#dcdfed] bg-white text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:ring-[#5566f6]/15")
          }
        />
        <button
          type="submit"
          className={
            "group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-semibold transition-all hover:-translate-y-0.5 sm:h-[56px] sm:px-7 sm:text-[16px] " +
            (dark
              ? "bg-white text-[#0b1024] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] hover:bg-white/90"
              : "bg-[#5566f6] text-white shadow-[0_20px_50px_-20px_rgba(85,102,246,0.55)] hover:bg-[#4a5bf0] hover:shadow-[0_24px_55px_-18px_rgba(85,102,246,0.65)]")
          }
        >
          {buttonLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </button>
      </form>

      <div
        className={
          "mt-3 text-[12px] " + (dark ? "text-white/60" : "text-[#9b9fb3]")
        }
      >
        Уже есть аккаунт?{" "}
        <Link
          href="/login"
          className={
            "font-medium underline-offset-4 hover:underline " +
            (dark ? "text-white/90" : "text-[#3848c7]")
          }
        >
          Войти
        </Link>
      </div>
    </div>
  );
}
