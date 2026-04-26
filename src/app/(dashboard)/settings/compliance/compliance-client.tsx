"use client";

import { useState } from "react";
import { Lock, Clock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

type Props = {
  initialRequireAdminForJournalEdit: boolean;
  initialShiftEndHour: number;
  initialLockPastDayEdits: boolean;
};

export function ComplianceClient({
  initialRequireAdminForJournalEdit,
  initialShiftEndHour,
  initialLockPastDayEdits,
}: Props) {
  const [value, setValue] = useState(initialRequireAdminForJournalEdit);
  const [shiftEndHour, setShiftEndHour] = useState(initialShiftEndHour);
  const [lockPastDay, setLockPastDay] = useState(initialLockPastDayEdits);
  const [saving, setSaving] = useState(false);
  const [savingShift, setSavingShift] = useState(false);
  const [savingLock, setSavingLock] = useState(false);

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

  async function handleLockPastDayToggle(next: boolean) {
    const previous = lockPastDay;
    setLockPastDay(next);
    setSavingLock(true);
    try {
      const response = await fetch("/api/settings/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockPastDayEdits: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось сохранить");
      }
      toast.success(
        next
          ? "Закрытый день включён: вчерашние записи заперты"
          : "Закрытый день выключен: записи можно править"
      );
    } catch (error) {
      setLockPastDay(previous);
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSavingLock(false);
    }
  }

  async function handleShiftEndChange(next: number) {
    const previous = shiftEndHour;
    setShiftEndHour(next);
    setSavingShift(true);
    try {
      const response = await fetch("/api/settings/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftEndHour: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось сохранить");
      }
      toast.success(
        `Час окончания смены: ${String(next).padStart(2, "0")}:00 UTC`
      );
    } catch (error) {
      setShiftEndHour(previous);
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSavingShift(false);
    }
  }

  return (
    <div className="space-y-4">
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
                  Когда включено — кнопка «Изменить данные» на уже
                  выполненной задаче появляется только у руководителей
                  (manager / head_chef / технолог / собственник). Рядовые
                  сотрудники видят запись как сохранённую, без возможности
                  её изменить.
                  <br />
                  <span className="text-[12px] text-[#9b9fb3]">
                    По умолчанию выключено. Большинству бригад эта строгость
                    не нужна — сотрудник, который только что заполнил
                    журнал, должен иметь возможность сам исправить опечатку.
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

      <div className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#3848c7]">
            <Clock className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[#0b1024]">
                  Час окончания рабочей смены
                </div>
                <p className="mt-1 max-w-[520px] text-[13px] leading-relaxed text-[#6f7282]">
                  Когда наступает этот час по UTC — система автоматически
                  закрывает все «общие задачи смены» (event-журналы) без
                  записей с пометкой «закрыто автоматически». Compliance
                  становится зелёным, но в weekly-digest менеджер увидит
                  это как флаг халатности.
                  <br />
                  <span className="text-[12px] text-[#9b9fb3]">
                    По умолчанию <strong>0</strong> (полночь UTC = 03:00
                    МСК). Для ночных смен поставьте, например, 6 — смена
                    закроется в 06:00 UTC = 09:00 МСК.
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {savingShift ? (
                  <Loader2 className="size-4 animate-spin text-[#9b9fb3]" />
                ) : null}
                <select
                  value={shiftEndHour}
                  onChange={(e) =>
                    handleShiftEndChange(Number(e.target.value))
                  }
                  disabled={savingShift}
                  className="h-10 rounded-xl border border-[#dcdfed] bg-white px-3 text-[14px] text-[#0b1024]"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00 UTC
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#3848c7]">
            <Lock className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-[#0b1024]">
                  Закрытый день — нельзя править вчерашние записи
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6f7282]">
                  Когда включено — после момента «начало сегодняшнего
                  дня» (с учётом часа окончания смены выше) рядовые
                  сотрудники не могут изменить или удалить записи за
                  прошедшие дни. Управление по-прежнему может, но
                  каждое такое действие пишется в журнал аудита с
                  отметкой <span className="font-mono text-[12px]">closed_day.override</span>.
                  <br />
                  <span className="text-[12px] text-[#9b9fb3]">
                    Используйте если ваш бизнес проходит ХАССП-аудит и
                    нужно гарантировать, что официант не «допишет»
                    вчерашний контроль t° задним числом.
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {savingLock ? (
                  <Loader2 className="size-4 animate-spin text-[#9b9fb3]" />
                ) : null}
                <Switch
                  checked={lockPastDay}
                  onCheckedChange={(next) => {
                    if (savingLock) return;
                    void handleLockPastDayToggle(next);
                  }}
                  disabled={savingLock}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
