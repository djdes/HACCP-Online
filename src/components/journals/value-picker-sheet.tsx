"use client";

import { Check } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { haptic } from "@/app/mini/_components/use-haptic";

export type PickerOption = {
  value: string;
  /** Что видит человек: «Здоров», «Отстранён». */
  label: string;
  /** Как это выглядит в бумажном журнале: «Зд.», «Отстр.». */
  code?: string;
  /** Пояснение под названием — когда выбор неочевиден. */
  hint?: string;
  tone?: "ok" | "warn" | "neutral";
};

const TONE: Record<
  NonNullable<PickerOption["tone"]>,
  { border: string; bg: string; text: string }
> = {
  ok: { border: "#c9efd8", bg: "#ecfdf5", text: "#116b2a" },
  warn: { border: "#f6d5cf", bg: "#fff4f2", text: "#a13a32" },
  neutral: { border: "#dcdfed", bg: "#ffffff", text: "#0b1024" },
};

/**
 * Выбор значения клетки — лист снизу с крупными вариантами.
 *
 * Раньше значение выбиралось либо перебором по кругу (тап менял вариант
 * вслепую: промахнулся — поехал дальше), либо в таблице шириной больше
 * метра. Оба способа для смены на кухне не годятся.
 *
 * Каждый вариант — строка в 56 px с названием и бумажным обозначением.
 * Человек видит и то, что выбирает, и то, что появится в журнале: код
 * «Зд.» сам по себе ничего не говорит, а название без кода не даёт
 * сверить с бумагой.
 */
export function ValuePickerSheet({
  open,
  onClose,
  title,
  subtitle,
  options,
  current,
  onPick,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  options: PickerOption[];
  current?: string | null;
  onPick: (value: string) => void;
  /** Очистить клетку. Не передан — очистка недоступна. */
  onClear?: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="space-y-2 pb-2">
        {options.map((option) => {
          const active = current === option.value;
          const tone = TONE[option.tone ?? "neutral"];
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                haptic("light");
                onPick(option.value);
                onClose();
              }}
              className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-4 text-left transition-colors"
              style={{
                borderColor: active ? "#5566f6" : tone.border,
                background: active ? "#f5f6ff" : tone.bg,
                boxShadow: active
                  ? "0 0 0 3px rgba(85,102,246,0.15)"
                  : undefined,
              }}
            >
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[15px] font-medium"
                  style={{ color: active ? "#3848c7" : tone.text }}
                >
                  {option.label}
                </span>
                {option.hint ? (
                  <span className="mt-0.5 block text-[12px] text-[#6f7282]">
                    {option.hint}
                  </span>
                ) : null}
              </span>

              {option.code ? (
                <span
                  className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold"
                  style={{
                    background: "rgba(11,16,36,0.05)",
                    color: tone.text,
                  }}
                >
                  {option.code}
                </span>
              ) : null}

              {active ? (
                <Check className="size-5 shrink-0 text-[#5566f6]" />
              ) : null}
            </button>
          );
        })}

        {onClear && current ? (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onClear();
              onClose();
            }}
            className="min-h-[48px] w-full rounded-2xl border border-dashed border-[#dcdfed] text-[14px] font-medium text-[#6f7282] transition-colors hover:bg-[#fafbff]"
          >
            Очистить клетку
          </button>
        ) : null}
      </div>
    </BottomSheet>
  );
}
