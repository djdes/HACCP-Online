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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [confirming, setConfirming] = useState(false);

  function start() {
    if (busy || !prereqsReady) return;
    // Пересоздание закрывает активные документы — спрашиваем. Когда
    // документов ещё нет, спрашивать не о чем: терять нечего.
    if (activeDocumentsCount > 0) {
      setConfirming(true);
      return;
    }
    void createAll();
  }

  async function createAll() {
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
    // Обычная светлая карточка дизайн-системы: градиентный «баннер»
    // выбивался из страницы настроек и перетягивал внимание с шагов выше.
    <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#f5f6ff] text-[#5566f6]">
            {alreadyHas ? (
              <CheckCircle2 className="size-6" />
            ) : (
              <PartyPopper className="size-6" />
            )}
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#9b9fb3]">
              Финал быстрой настройки
            </div>
            <h2 className="mt-1 text-[18px] font-semibold leading-tight text-[#0b1024]">
              {alreadyHas
                ? `Документы уже созданы (${activeDocumentsCount} активн.)`
                : "Готовы создать все документы журналов"}
            </h2>
            <p className="mt-1 max-w-[480px] text-[13px] leading-relaxed text-[#6f7282]">
              {alreadyHas
                ? "Можно пересоздать с нуля — старые закроются, а в свежих уже будут вписаны сотрудники с должностями."
                : "Один клик — заведёт документы по всем включённым журналам и впишет сотрудников с должностями. Показатели и подписи остаются за людьми."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
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

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          await createAll();
        }}
        variant="warn"
        title="Пересоздать документы?"
        description={`Сейчас активных документов: ${activeDocumentsCount}. Они закроются, вместо них заведутся свежие на текущий период.`}
        bullets={[
          { label: "Записи в старых документах сохранятся — они закрываются, а не удаляются" },
          { label: "В новых уже вписаны сотрудники, должности и ответственные" },
          {
            label:
              "Показатели, отметки и подписи останутся пустыми — их ставят люди",
            tone: "warn",
          },
        ]}
        confirmLabel="Пересоздать"
      />
    </section>
  );
}
