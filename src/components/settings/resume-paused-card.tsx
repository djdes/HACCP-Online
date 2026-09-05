"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PauseCircle, Play } from "lucide-react";
import { toast } from "sonner";

/**
 * Карточка «Аккаунт на паузе» на странице подписки. Одна кнопка —
 * «Возобновить работу»: возвращает план, с которого ушли в паузу, и
 * снова включает автоматику журналов. Без подтверждения: действие
 * безопасное и обратимое (пауза наступит снова через 100 дней тишины).
 */
export function ResumePausedCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resume() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/subscription/resume", { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string; plan?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Не удалось возобновить работу");
      toast.success("Аккаунт снова активен — автозаполнение и задачи включены");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось возобновить работу");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#ffd2cd] bg-[#fff4f2] p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#d2453d] shadow-[0_0_0_1px_rgba(255,210,205,1)]">
          <PauseCircle className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#a13a32]">
            Аккаунт на паузе
          </div>
          <h2 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#0b1024]">
            100 дней не было записей — автоматика остановлена
          </h2>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.6] text-[#3c4053]">
            Автозаполнение журналов, задачи сотрудникам и напоминания не
            работают, пока аккаунт на паузе. Записи, документы и настройки
            сохранены. Нажмите кнопку — всё включится сразу.
          </p>
          <button
            type="button"
            onClick={resume}
            disabled={busy}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {busy ? "Включаем…" : "Возобновить работу"}
          </button>
        </div>
      </div>
    </section>
  );
}
