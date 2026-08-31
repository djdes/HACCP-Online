"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

/**
 * Правка карточки организации из ROOT-панели.
 *
 * Название, тариф и срок подписки раньше менялись только руками в базе:
 * на просьбу клиента «продлите нам месяц» уходил заход на сервер.
 */

const PLANS: Array<{ value: string; label: string }> = [
  { value: "trial", label: "Бесплатный (trial)" },
  { value: "free", label: "Бесплатный (free)" },
  { value: "paid", label: "Платный" },
  { value: "paused", label: "Приостановлен" },
];

/** `Date` → `YYYY-MM-DD` для `<input type="date">`. */
function toDateInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function OrgSettingsForm({
  organizationId,
  initialName,
  initialPlan,
  initialSubscriptionEnd,
}: {
  organizationId: string;
  initialName: string;
  initialPlan: string;
  /** ISO-строка или null. */
  initialSubscriptionEnd: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [plan, setPlan] = useState(initialPlan);
  const [endsAt, setEndsAt] = useState(toDateInput(initialSubscriptionEnd));
  const [busy, setBusy] = useState(false);

  const dirty =
    name !== initialName ||
    plan !== initialPlan ||
    endsAt !== toDateInput(initialSubscriptionEnd);

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/root/organizations/${organizationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            subscriptionPlan: plan,
            // Пустая дата — бессрочная подписка, а не «сегодня».
            subscriptionEnd: endsAt ? `${endsAt}T00:00:00.000Z` : null,
          }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось сохранить");
      }
      toast.success("Сохранено");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="space-y-1.5">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          Название
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-10 w-full rounded-xl border border-[#dcdfed] px-3.5 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
        />
      </label>

      <label className="space-y-1.5">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          Тариф
        </span>
        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          className="h-10 w-full rounded-xl border border-[#dcdfed] bg-white px-3 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
        >
          {PLANS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          Действует до
        </span>
        <input
          type="date"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          className="h-10 w-full rounded-xl border border-[#dcdfed] px-3.5 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
        />
        <span className="block text-[11px] text-[#9b9fb3]">
          Пусто — бессрочно
        </span>
      </label>

      <div className="sm:col-span-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !dirty}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#5566f6] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {dirty ? "Сохранить" : "Сохранено"}
        </button>
      </div>
    </div>
  );
}
