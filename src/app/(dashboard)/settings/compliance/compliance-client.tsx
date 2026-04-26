"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

type Props = {
  initialRequireAdminForJournalEdit: boolean;
};

export function ComplianceClient({
  initialRequireAdminForJournalEdit,
}: Props) {
  const [value, setValue] = useState(initialRequireAdminForJournalEdit);
  const [saving, setSaving] = useState(false);

  async function handleToggle(next: boolean) {
    const previous = value;
    setValue(next);
    setSaving(true);
    try {
      const response = await fetch("/api/settings/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireAdminForJournalEdit: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось сохранить");
      }
      toast.success(
        next
          ? "Включено: править могут только администраторы"
          : "Выключено: может править любой сотрудник"
      );
    } catch (error) {
      setValue(previous);
      toast.error(
        error instanceof Error ? error.message : "Ошибка сохранения"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#3848c7]">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[#0b1024]">
                Только админы могут править выполненные записи
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6f7282]">
                Когда включено — кнопка «Изменить данные» на уже выполненной
                задаче появляется только у руководителей (manager / head_chef
                / технолог / собственник). Рядовые сотрудники видят запись
                как сохранённую, без возможности её изменить.
                <br />
                <span className="text-[12px] text-[#9b9fb3]">
                  По умолчанию выключено. Большинству бригад эта строгость
                  не нужна — сотрудник, который только что заполнил журнал,
                  должен иметь возможность сам исправить опечатку.
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {saving ? (
                <Loader2 className="size-4 animate-spin text-[#9b9fb3]" />
              ) : null}
              <Switch
                checked={value}
                onCheckedChange={(next) => {
                  if (saving) return;
                  void handleToggle(next);
                }}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[13px] leading-relaxed text-[#6f7282]">
        <span className="font-medium text-[#0b1024]">История правок</span>{" "}
        сохраняется в журнале независимо от этого переключателя — каждое
        изменение фиксируется с указанием автора, времени и предыдущих
        значений. Это требование ХАССП, его нельзя отключить.
      </div>
    </div>
  );
}
