"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Опрос NPS: одна строка с оценками 0–10, после выбора — необязательный
 * комментарий. Показывается сервером только когда пора (lib/nps-data.ts).
 */
export function NpsBanner({ variant = "site" }: { variant?: "site" | "mini" }) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"ask" | "comment" | "done" | "hidden">("ask");

  async function send(body: Record<string, unknown>) {
    const response = await fetch("/api/nps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error("Не удалось отправить");
  }

  async function dismiss() {
    setState("hidden");
    await send({ dismiss: true }).catch(() => null);
  }

  async function submit() {
    if (score === null) return;
    try {
      await send({ score, comment });
      setState("done");
      toast.success("Спасибо! Это помогает делать WeSetup лучше.");
      setTimeout(() => setState("hidden"), 2500);
    } catch {
      toast.error("Не удалось отправить, попробуйте позже");
    }
  }

  if (state === "hidden") return null;
  const mini = variant === "mini";
  const shell = mini
    ? "mb-4 rounded-2xl border px-4 py-3.5"
    : "mb-5 rounded-3xl border border-[#ececf4] bg-white px-5 py-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]";
  const style = mini ? { background: "var(--mini-card-solid-bg)", borderColor: "var(--mini-divider)", color: "var(--mini-text)" } : undefined;

  return (
    <div className={shell} style={style} data-testid="nps-banner" role="region" aria-label="Опрос">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold">Порекомендуете ли WeSetup коллегам?</div>
          <p className={`mt-0.5 text-[12.5px] ${mini ? "opacity-70" : "text-[#6f7282]"}`}>0 — точно нет, 10 — обязательно. Один вопрос раз в квартал.</p>
        </div>
        <button type="button" onClick={() => void dismiss()} aria-label="Не сейчас" className={`shrink-0 rounded-full p-1 ${mini ? "opacity-60" : "text-[#9b9fb3] hover:bg-[#f5f6ff] hover:text-[#0b1024]"}`}>
          <X className="size-4" />
        </button>
      </div>
      {state === "done" ? (
        <p className="mt-3 text-[13px] text-[#116b2a]">Спасибо — оценка записана.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setScore(n);
                  setState("comment");
                }}
                aria-pressed={score === n}
                className={`size-9 rounded-xl text-[13px] font-semibold tabular-nums transition-colors ${
                  score === n ? "bg-[#5566f6] text-white" : mini ? "border border-current/20" : "border border-[#dcdfed] bg-white text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {state === "comment" ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 1000))}
                placeholder="Что улучшить? (необязательно)"
                className={`h-11 min-w-0 flex-1 rounded-2xl border px-4 text-[14px] ${mini ? "mini-input" : "border-[#dcdfed] bg-white text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"}`}
              />
              <button type="button" onClick={() => void submit()} className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]" data-testid="nps-submit">
                Отправить
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
