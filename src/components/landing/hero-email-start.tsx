"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

/**
 * Стартовая форма лендинга: посетитель вводит почту — и аккаунт
 * создаётся сразу, без анкеты и кода из письма. Дальше он уже внутри
 * кабинета, а пароль уходит письмом.
 *
 * Почта здесь обязательна (в отличие от прежней версии, которая пускала
 * дальше и с пустым полем): без валидного адреса пароль доставить
 * некуда, и аккаунт окажется мёртвым.
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dark = tone === "dark";

  /**
   * Метрика: счётчик берём из той же переменной, что и сам скрипт
   * Метрики, — хардкодить номер нельзя.
   */
  function goal(name: string) {
    try {
      const counter = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID);
      if (Number.isFinite(counter) && counter > 0) {
        (
          window as unknown as {
            ym?: (id: number, action: string, goal: string) => void;
          }
        ).ym?.(counter, "reachGoal", name);
      }
    } catch {
      /* метрика недоступна — не мешаем сценарию */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value.includes("@")) {
      setError("Введите адрес электронной почты");
      return;
    }

    setError(null);
    setLoading(true);
    goal("hero_email_submit");

    try {
      const res = await fetch("/api/auth/instant-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.created) {
        goal("instant_register_done");
        router.push("/dashboard?welcome=1");
        router.refresh();
        return;
      }
      if (res.ok && data.exists) {
        // Аккаунт уже есть — уводим на вход с подсказкой и заполненной
        // почтой, чтобы человек не гадал, почему «не регистрируется».
        router.push(`/login?email=${encodeURIComponent(value)}&exists=1`);
        return;
      }
      setError(data.error ?? "Не получилось — попробуйте ещё раз");
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
          className={
            "group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 sm:h-[56px] sm:px-7 sm:text-[16px] " +
            (dark
              ? "bg-white text-[#0b1024] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] hover:bg-white/90"
              : "bg-[#5566f6] text-white shadow-[0_20px_50px_-20px_rgba(85,102,246,0.55)] hover:bg-[#4a5bf0] hover:shadow-[0_24px_55px_-18px_rgba(85,102,246,0.65)]")
          }
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Создаём аккаунт…
            </>
          ) : (
            <>
              {buttonLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      {error ? (
        <p
          className={
            "mt-2.5 text-[13px] " + (dark ? "text-[#ffb4ab]" : "text-[#a13a32]")
          }
        >
          {error}
        </p>
      ) : null}

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
