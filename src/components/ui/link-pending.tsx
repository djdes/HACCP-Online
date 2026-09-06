"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Отклик на нажатие ссылки, пока страница ещё грузится.
 *
 * Зачем: на медленном интернете между нажатием и открытием новой
 * страницы проходило несколько секунд без единого признака, что
 * нажатие вообще засчиталось — люди жали второй и третий раз.
 * `useLinkStatus` из Next отдаёт `pending` ровно на это время.
 *
 * Работает только внутри `<Link>` — за его пределами всегда `false`.
 */

/** Крутилка в строку с текстом кнопки. */
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2
      aria-hidden
      className={cn("size-4 shrink-0 animate-spin", className)}
    />
  );
}

/**
 * Заливка поверх карточки-ссылки: лёгкое затемнение и крутилка по
 * центру. Родителю нужен `relative` и `overflow-hidden`.
 */
export function LinkPendingOverlay({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-white/60 backdrop-blur-[1px]",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin text-[#5566f6]" />
    </span>
  );
}

/**
 * `<Link>` с крутилкой: тот же API, что у next/link, плюс индикатор
 * в конце содержимого. `indicator="overlay"` — для карточек,
 * `"spinner"` (по умолчанию) — для кнопок и строк меню.
 */
export function PendingLink({
  children,
  indicator = "spinner",
  spinnerClassName,
  className,
  ...props
}: ComponentProps<typeof Link> & {
  children: ReactNode;
  indicator?: "spinner" | "overlay";
  spinnerClassName?: string;
}) {
  return (
    <Link
      {...props}
      className={cn(indicator === "overlay" && "relative", className)}
    >
      {children}
      {indicator === "overlay" ? (
        <LinkPendingOverlay />
      ) : (
        <LinkPendingSpinner className={spinnerClassName} />
      )}
    </Link>
  );
}
