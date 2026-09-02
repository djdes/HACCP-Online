import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export { planLabel } from "@/lib/plan-limits";

/**
 * Мелкие примитивы партнёрского кабинета: кнопки, плитки, пилюли,
 * форматирование. Всё — рецепты дизайн-системы (indigo #5566f6,
 * rounded-2xl, border #ececf4), собранные в одном месте, чтобы шесть
 * страниц кабинета выглядели одинаково.
 */

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors duration-200 hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:opacity-60";
export const btnOutline =
  "inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors duration-200 hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:cursor-not-allowed disabled:opacity-60";
export const btnDanger =
  "inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#e0445a] to-[#f2607a] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(224,68,90,0.55)] transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
export const inputClass =
  "h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15 disabled:bg-[#fafbff] disabled:text-[#6f7282]";
export const textareaClass =
  "w-full rounded-2xl border border-[#dcdfed] bg-white px-4 py-3 text-[15px] leading-[1.55] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15";
export const labelClass = "mb-1.5 block text-[13px] font-medium text-[#3c4053]";
export const hintClass = "mt-1.5 text-[12px] leading-[1.5] text-[#6f7282]";

export function Card({
  children,
  className,
  title,
  eyebrow,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-6",
        className,
      )}
    >
      {eyebrow || title || actions ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
                {title}
              </h2>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type PillTone = "neutral" | "ok" | "warn" | "danger" | "indigo";

const PILL_TONES: Record<PillTone, string> = {
  neutral: "bg-[#f4f5fb] text-[#3c4053]",
  ok: "bg-[#ecfdf5] text-[#116b2a]",
  warn: "bg-[#fff7ed] text-[#9a4a06]",
  danger: "bg-[#fff4f2] text-[#a13a32]",
  indigo: "bg-[#eef1ff] text-[#3848c7]",
};

export function Pill({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-12 text-center">
      <div className="text-[15px] font-medium text-[#0b1024]">{title}</div>
      {hint ? <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-[1.55] text-[#6f7282]">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className={cn(hintClass, "block")}>{hint}</span> : null}
    </label>
  );
}

/* ---------- форматирование ---------- */

export function formatRubFixed(value: number): string {
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function formatRubShort(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MONTHS_RU = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

/** `2026-09` → «сентябрь 2026». */
export function formatMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return periodMonth;
  return `${MONTHS_RU[m - 1]} ${y}`;
}

export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return "нет записей";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff <= 0) return "сегодня";
  if (diff === 1) return "вчера";
  if (diff < 7) return `${diff} дн. назад`;
  return formatDate(iso);
}

/** Ответ API в человекочитаемую ошибку. */
export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}
