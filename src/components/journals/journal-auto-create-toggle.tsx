"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

/**
 * Переключатель «создавать документ на новый период автоматически».
 *
 * Стоит в самом журнале, а не только в настройках организации: решение
 * «пусть заводится само» человек принимает ровно тогда, когда впервые
 * заводит документ руками и понимает, что через месяц придётся снова.
 * Идти за этим в `/settings/auto-journals` он не догадается.
 *
 * Своего состояния страница документа не знает — она про настройки
 * организации ничего не грузит, поэтому переключатель спрашивает его сам.
 *
 * ВАЖНО: включает ТОЛЬКО создание пустого документа со строками,
 * помещениями и ответственными. Показатели, отметки и подписи остаются
 * пустыми — их ставят люди. Это compliance-журнал, и заполненное за
 * непроведённый контроль значение при проверке хуже, чем пустая графа.
 */
export function JournalAutoCreateToggle({
  templateCode,
  disabled = false,
}: {
  templateCode: string;
  disabled?: boolean;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/organizations/auto-journals")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setEnabled(Boolean(data.automation?.[templateCode]?.autoCreate));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateCode]);

  async function toggle(next: boolean) {
    setBusy(true);
    const previous = enabled;
    setEnabled(next);
    try {
      // Эндпоинт СЛИВАЕТ переданные пункты с сохранённой картой, а не
      // заменяет её — поэтому одного пункта достаточно, остальные
      // журналы не пострадают.
      const res = await fetch("/api/organizations/auto-journals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ code: templateCode, autoCreate: next, autoFill: false }],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Не удалось сохранить");
      }
      toast.success(
        next
          ? "Документ на новый период будет создаваться сам"
          : "Автосоздание выключено",
      );
    } catch (error) {
      setEnabled(previous);
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить",
      );
    } finally {
      setBusy(false);
    }
  }

  if (enabled === null) return null;

  return (
    <label className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#f5f6ff] px-4 py-2.5 print:hidden">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#5566f6]">
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CalendarPlus className="size-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-[#0b1024]">
          Создавать журнал на новый период автоматически
        </span>
        <span className="block text-[12px] leading-snug text-[#6f7282]">
          В начале периода заведётся новый документ со строками и
          ответственными. Показатели и подписи остаются за людьми.
        </span>
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={(value) => void toggle(value)}
        disabled={disabled || busy}
      />
    </label>
  );
}
