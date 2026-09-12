"use client";

import { useEffect } from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";

import { haptic } from "@/app/mini/_components/use-haptic";

/**
 * Экран ошибки Mini App.
 *
 * Без него любая упавшая страница отдавала стандартный экран Next —
 * на телефоне это выглядит как поломка всего приложения. Здесь человек
 * видит, что делать, и может повторить, не перезапуская Telegram.
 *
 * Вид повторяет карточку ошибки с главной (`page.tsx`), чтобы ошибка
 * выглядела одинаково во всём кабинете.
 */
export default function MiniError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Отдельная вибрация: человек мог отвести взгляд, пока грузилось.
    haptic("error");
    console.error("[mini] экран упал:", error);
  }, [error]);

  return (
    <div
      className="mini-card flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
      role="alert"
    >
      <span
        className="flex size-12 items-center justify-center rounded-2xl"
        style={{ background: "var(--mini-crimson-soft)" }}
      >
        <ShieldAlert className="size-6" style={{ color: "var(--mini-crimson)" }} />
      </span>
      <div>
        <div className="text-[16px] font-semibold" style={{ color: "var(--mini-text)" }}>
          Экран не открылся
        </div>
        <p
          className="mt-1 text-[13px] leading-[1.5]"
          style={{ color: "var(--mini-text-muted)" }}
        >
          Обычно помогает повторить. Если не помогло — закройте и откройте
          приложение заново; заполненное не потеряется.
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          haptic("light");
          reset();
        }}
        className="mini-btn-primary mini-press inline-flex items-center gap-2"
      >
        <RotateCcw className="size-4" />
        Повторить
      </button>
    </div>
  );
}
