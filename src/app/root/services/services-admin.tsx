"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

import {
  formatServicePrice,
  SERVICE_CATEGORY_LABEL,
  SERVICE_CATEGORY_ORDER,
  type PlatformServiceItem,
} from "@/lib/services/constants";

/**
 * Правка каталога построчно, как у тарифов: одна опечатка не блокирует
 * сохранение соседней услуги, и видно, что именно поменялось.
 */
const INPUT_CLASS =
  "h-10 w-full rounded-2xl border border-[#dcdfed] bg-white px-3 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15";

export function ServicesAdmin({ initial }: { initial: PlatformServiceItem[] }) {
  const [rows, setRows] = useState(initial);

  const patch = (key: string, changes: Partial<PlatformServiceItem>) =>
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...changes } : row))
    );

  return (
    <div className="space-y-4">
      {rows.map((service) => (
        <ServiceRow
          key={service.key}
          service={service}
          onChange={(changes) => patch(service.key, changes)}
        />
      ))}
    </div>
  );
}

function ServiceRow({
  service,
  onChange,
}: {
  service: PlatformServiceItem;
  onChange: (changes: Partial<PlatformServiceItem>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/root/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: service.key,
          title: service.title,
          summary: service.summary,
          description: service.description,
          priceRub: service.priceRub,
          priceFrom: service.priceFrom,
          unit: service.unit,
          category: service.category,
          active: service.active,
          sort: service.sort,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить");
      setSaved(true);
      toast.success("Услуга сохранена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <code className="rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[12px] text-[#3848c7]">
          {service.key}
        </code>
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-[#6f7282]">
            {formatServicePrice(service)}
          </span>
          <label className="inline-flex items-center gap-2 text-[13px] text-[#3c4053]">
            <input
              type="checkbox"
              checked={service.active}
              onChange={(event) => onChange({ active: event.target.checked })}
              className="size-4 accent-[#5566f6]"
            />
            Продаётся
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[12px] font-medium text-[#6f7282]">
            Название
          </span>
          <input
            value={service.title}
            onChange={(event) => onChange({ title: event.target.value })}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[12px] font-medium text-[#6f7282]">
            Короткое описание для карточки
          </span>
          <input
            value={service.summary}
            onChange={(event) => onChange({ summary: event.target.value })}
            className={INPUT_CLASS}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[12px] font-medium text-[#6f7282]">
            Подробности
          </span>
          <textarea
            value={service.description}
            onChange={(event) => onChange({ description: event.target.value })}
            rows={3}
            className="w-full rounded-2xl border border-[#dcdfed] bg-white px-3 py-2.5 text-[14px] leading-[1.5] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[#6f7282]">
            Цена, ₽ (пусто = по запросу)
          </span>
          <input
            type="number"
            min={0}
            value={service.priceRub ?? ""}
            onChange={(event) =>
              onChange({
                priceRub:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[#6f7282]">
            Приписка к цене
          </span>
          <input
            value={service.unit ?? ""}
            onChange={(event) =>
              onChange({ unit: event.target.value || null })
            }
            placeholder="за услугу, в месяц, за час"
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[#6f7282]">
            Категория
          </span>
          <select
            value={service.category}
            onChange={(event) =>
              onChange({
                category: event.target.value as PlatformServiceItem["category"],
              })
            }
            className={INPUT_CLASS}
          >
            {SERVICE_CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {SERVICE_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[#6f7282]">
            Порядок вывода
          </span>
          <input
            type="number"
            min={0}
            value={service.sort}
            onChange={(event) => onChange({ sort: Number(event.target.value) })}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Списание баллов возможно только при фиксированной цене:
            «от N ₽» — это оценка до разговора, и списывать по ней нельзя. */}
        <label className="inline-flex items-center gap-2 text-[13px] text-[#3c4053]">
          <input
            type="checkbox"
            checked={service.priceFrom}
            onChange={(event) => onChange({ priceFrom: event.target.checked })}
            className="size-4 accent-[#5566f6]"
          />
          Цена «от» — оплату баллами не предлагаем
        </label>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-[#4a5bf0] disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : null}
          Сохранить
        </button>
      </div>
    </div>
  );
}
