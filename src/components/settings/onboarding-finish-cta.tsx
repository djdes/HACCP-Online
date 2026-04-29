"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Lock,
  Loader2,
  PartyPopper,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

type Props = {
  /** Все обязательные шаги пройдены — кнопку можно жать. */
  prereqsReady: boolean;
  /** Список того, чего не хватает (показываем под disabled-кнопкой). */
  missing: string[];
  /** Сколько активных документов уже есть — для visual hint. */
  activeDocumentsCount: number;
};

export function OnboardingFinishCta({
  prereqsReady,
  missing,
  activeDocumentsCount,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function createAll() {
    if (busy || !prereqsReady) return;
    if (
      activeDocumentsCount > 0 &&
      !window.confirm(
        `Сейчас уже есть ${activeDocumentsCount} активных документ(ов). ` +
          "При создании они будут закрыты, и заведутся свежие — со строками " +
          "по умолчанию и расставленными ответственными. Продолжить?"
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(
        "/api/settings/journal-responsibles/recreate-documents",
        { method: "POST" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Не удалось создать");
        return;
      }
      toast.success(
        `Создано документов: ${data?.created ?? 0}` +
          (data?.closed ? `, закрыто старых: ${data.closed}` : "")
      );
      // После успеха — переходим в журналы, чтобы пользователь сразу
      // увидел результат.
      setTimeout(() => router.push("/journals"), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  if (!prereqsReady) {
    return (
      <section className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff8eb] text-[#a13a32]">
            <Lock className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-[16px] font-semibold text-[#0b1024]">
              Создать документы журналов — пока недоступно
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#6f7282]">
              Сначала закройте обязательные шаги выше, и кнопка создания
              документов разблокируется.
            </p>
            {missing.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {missing.map((m) => (
                  <li
                    key={m}
                    className="flex items-start gap-2 text-[12px] text-[#a13a32]"
                  >
                    <span className="mt-1 inline-flex size-1.5 shrink-0 rounded-full bg-[#a13a32]" />
                    {m}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const alreadyHas = activeDocumentsCount > 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#5566f6]/30 bg-gradient-to-br from-[#5566f6] to-[#7a5cff] p-5 text-white shadow-[0_20px_50px_-20px_rgba(85,102,246,0.55)] sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 size-[280px] rounded-full bg-white/10 blur-[80px]" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 size-[220px] rounded-full bg-[#0b1024]/30 blur-[60px]" />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            {alreadyHas ? (
              <CheckCircle2 className="size-6" />
            ) : (
              <PartyPopper className="size-6" />
            )}
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">
              Финал быстрой настройки
            </div>
            <h2 className="mt-1 text-[18px] font-semibold leading-tight">
              {alreadyHas
                ? `Документы уже созданы (${activeDocumentsCount} активн.)`
                : "Готовы создать все документы журналов"}
            </h2>
            <p className="mt-1 max-w-[480px] text-[13px] text-white/80">
              {alreadyHas
                ? "Можно пересоздать с нуля — старые закроются, заведутся свежие со строками и текущими ответственными."
                : "Один клик — заведёт документы по всем включённым журналам, расставит ответственных и подтянет дефолтные строки."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={createAll}
          disabled={busy}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-5 text-[14px] font-semibold text-[#5566f6] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wand2 className="size-4" />
          )}
          {busy
            ? "Создаём…"
            : alreadyHas
              ? "Пересоздать документы"
              : "Создать все документы"}
        </button>
      </div>
    </section>
  );
}
