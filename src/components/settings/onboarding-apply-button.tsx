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
  const [pickedType, setPickedType] = useState<string>(orgType ?? "other");

  const typeLabel = TYPE_LABELS[pickedType] ?? "Другое";
  const typeChanged = pickedType !== (orgType ?? "other");

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: pickedType,
          updateOrgType: typeChanged,
          seedDemoStaff: seed,
          applyJournalAccess: true,
          // По умолчанию включаем — клиент перестаёт видеть нерелевантные
          // 35 журналов в дашборде, и cron auto-journals начинает сам
          // создавать ему документы на месяц.
          applyDisabledJournals: true,
          applyAutoJournals: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Не удалось применить");
      const orgUpd = data.orgUpdated as
        | { disabledJournalCodes?: string[]; autoJournalCodes?: string[] }
        | undefined;
      const disabledN = orgUpd?.disabledJournalCodes?.length ?? 0;
      const autoN = orgUpd?.autoJournalCodes?.length ?? 0;
      toast.success(
        `Применён шаблон «${data.presetLabel}». Должностей: ${data.positionsCreated}, доступов: ${data.journalAccessRowsCreated}, скрыто журналов: ${disabledN}, автосоздание: ${autoN}` +
          (seed ? `, демо-сотрудников: ${data.staffCreated}` : "")
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
            Создаст должности, привяжет журналы, отключит нерелевантные
            и включит автосоздание документов на каждый месяц.
            Идемпотентно — повторное нажатие безопасно.
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <label className="text-[12px] font-medium text-[#3a3f55]">
              Тип компании:
            </label>
            <select
              value={pickedType}
              onChange={(e) => setPickedType(e.target.value)}
              className="h-8 rounded-lg border border-[#dcdfed] bg-white px-2 text-[12px] text-[#0b1024]"
              disabled={busy}
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {typeChanged ? (
              <span className="rounded-full bg-[#fff8eb] px-2 py-0.5 text-[11px] text-[#7a4a00]">
                будет переписан
              </span>
            ) : null}
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
