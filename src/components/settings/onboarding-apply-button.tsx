"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  /** Текущий type организации — управляющий шаблоном по умолчанию. */
  orgType: string | null;
  /** Если true — кнопка предложит заодно «заселить демо-сотрудников» */
  showSeedStaff?: boolean;
  /** Текст лейбла, чтобы переиспользовать на разных страницах. */
  label?: string;
};

const TYPE_LABELS: Record<string, string> = {
  restaurant: "Ресторан / кафе",
  meat: "Мясная продукция",
  dairy: "Молочная продукция",
  bakery: "Хлебобулочные изделия",
  confectionery: "Кондитерские изделия",
  other: "Другое",
};

/**
 * Применяет онбординг-пресет: создаёт канонические должности + связи
 * journal-access. Опционально заселяет демо-сотрудников (для пустой
 * новой компании). Идемпотентно: повторное нажатие не дублирует.
 */
export function OnboardingApplyButton({ orgType, showSeedStaff = false, label }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [seed, setSeed] = useState(showSeedStaff);

  const typeLabel = TYPE_LABELS[orgType ?? "other"] ?? "Другое";

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedDemoStaff: seed,
          applyJournalAccess: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не удалось применить");
      toast.success(
        `Применён шаблон «${data.presetLabel}». Должностей: ${data.positionsCreated}, доступов: ${data.journalAccessRowsCreated}` +
          (seed ? `, демо-сотрудников создано: ${data.staffCreated}` : "")
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#dcdfed] bg-[#f5f6ff] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5566f6]/15 text-[#5566f6]">
          <Sparkles className="size-5" />
        </span>
        <div>
          <div className="text-[14px] font-semibold text-[#0b1024]">
            {label ?? `Применить шаблон «${typeLabel}»`}
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-[#6f7282]">
            Создаст должности и привяжет журналы по умолчанию для
            типа «{typeLabel}». Идемпотентно: повторное нажатие безопасно.
          </div>
          {showSeedStaff ? (
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[12px] text-[#3a3f55]">
              <input
                type="checkbox"
                className="size-4 rounded border-[#dcdfed]"
                checked={seed}
                onChange={(e) => setSeed(e.target.checked)}
              />
              Заодно заселить демо-сотрудников (для проверки)
            </label>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        onClick={apply}
        disabled={busy}
        className="h-11 rounded-xl bg-[#5566f6] px-4 text-[13px] font-medium text-white hover:bg-[#4a5bf0]"
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        Применить шаблон
      </Button>
    </div>
  );
}
