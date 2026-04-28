"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowDownToLine, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Summary = {
  templateCode: string;
  templateName: string;
  documentId: string;
  documentTitle: string;
  copied: number;
  kept: number;
  skippedReason?: "no_yesterday" | "out_of_period" | "closed";
};

type Result = {
  totalCopied: number;
  totalKept: number;
  processed: number;
  yesterdayKey: string;
  todayKey: string;
  summaries: Summary[];
};

function pluralRu(one: string, few: string, many: string) {
  return (count: number) => {
    const abs = Math.abs(count) % 100;
    const lastDigit = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (lastDigit === 1) return one;
    if (lastDigit >= 2 && lastDigit <= 4) return few;
    return many;
  };
}
const recordWord = pluralRu("запись", "записи", "записей");
const journalWord = pluralRu("журнал", "журнала", "журналов");

/**
 * «Закрыть день одним кликом» — берёт вчерашние записи (hygiene,
 * climate, cold-eq, cleaning_ventilation_checklist, uv_lamp, fryer_oil,
 * health_check) и копирует их в сегодня для всех активных документов
 * организации. Уже заполненные строки НЕ перезаписываются — фишка
 * именно в том чтобы догнать пропуски, а не сломать актуальные данные.
 *
 * Видна только management-ролям. На дашборде — рядом с
 * BulkAssignTodayButton; вместе они закрывают пару «есть пропуски —
 * либо разошлите задачи всем, либо просто скопируйте вчера за смену».
 */
export function CloseDayCard({ unfilledCount }: { unfilledCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleClose() {
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/dashboard/close-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Не удалось закрыть день");
      }
      const r = data as Result;
      setResult(r);
      if (r.totalCopied === 0) {
        toast.info(
          r.processed === 0
            ? "Нет активных ежедневных журналов для копирования."
            : "Нечего копировать — за вчера записей не было ни в одном журнале."
        );
      } else {
        toast.success(
          `Скопировано ${r.totalCopied} ${recordWord(r.totalCopied)} в ${r.processed} ${journalWord(r.processed)}`
        );
        startTransition(() => router.refresh());
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ошибка при закрытии дня"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || pending;

  return (
    <div className="mt-3 rounded-2xl border border-[#ececf4] bg-gradient-to-br from-[#f5f6ff] to-[#fafbff] px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[#0b1024]">
            Закрыть день одним кликом
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-[#6f7282]">
            Копирует вчерашние записи в сегодня для всех ежедневных
            журналов с активным документом. Уже заполненные строки
            сохраняются. {unfilledCount > 0 ? (
              <span className="font-medium text-[#3848c7]">
                Сейчас {unfilledCount} {journalWord(unfilledCount)} без записей за сегодня.
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[13px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
        >
          <ArrowDownToLine className="size-4" />
          {busy ? "Копирую…" : "Закрыть день"}
        </button>
      </div>

      {result ? (
        <div className="mt-3 space-y-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 py-2.5 text-[12px]">
          <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-[#0b1024]">
            <span>
              Итого: <span className="text-[#136b2a]">+{result.totalCopied}</span>
              {result.totalKept > 0 ? (
                <span className="ml-2 text-[#6f7282]">
                  сохранено {result.totalKept}
                </span>
              ) : null}
            </span>
            <span className="text-[#9b9fb3]">
              {result.yesterdayKey} → {result.todayKey}
            </span>
          </div>
          <div className="space-y-1 pt-1">
            {result.summaries.map((s) => (
              <div
                key={s.documentId}
                className="flex items-center justify-between gap-2 text-[12px]"
              >
                <span className="min-w-0 truncate text-[#3c4053]">
                  {s.templateName}
                </span>
                <span className="shrink-0 inline-flex items-center gap-1.5">
                  {s.skippedReason === "no_yesterday" ? (
                    <span className="inline-flex items-center gap-1 text-[#9b9fb3]">
                      <AlertTriangle className="size-3" />
                      нет вчерашних
                    </span>
                  ) : s.skippedReason === "out_of_period" ? (
                    <span className="inline-flex items-center gap-1 text-[#9b9fb3]">
                      <AlertTriangle className="size-3" />
                      вне периода
                    </span>
                  ) : s.copied > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-medium text-[#136b2a]">
                      <CheckCircle2 className="size-3" />+{s.copied}
                    </span>
                  ) : (
                    <span className="text-[#6f7282]">всё уже есть</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
