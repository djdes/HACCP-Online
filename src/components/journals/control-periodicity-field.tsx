"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CONTROL_PERIODICITY_MAX_LENGTH } from "@/lib/control-periodicity";

/**
 * Поле «Периодичность контроля» — одно на все диалоги создания документа
 * и на модалки «Настройки журнала».
 *
 * Раньше текст был read-only карточкой (и только в гигиене). По эталону
 * (lk.haccp-online.ru) это часть бумажной шапки документа, и владелец
 * должен уметь переписать его под своё предприятие: «два раза в смену»,
 * «при каждой приёмке» и т.п. Значение уезжает в
 * `JournalDocument.config.controlPeriodicity`.
 */
export function ControlPeriodicityField({
  value,
  onChange,
  disabled = false,
  label = "Периодичность контроля",
  hint = "Текст печатается в шапке документа под строкой «СИСТЕМА ХАССП». Оставьте пустым, чтобы убрать строку.",
  className,
  labelClassName,
  textareaClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  labelClassName?: string;
  textareaClassName?: string;
}) {
  const id = useId();

  return (
    <div className={cn("space-y-2", className)}>
      <Label
        htmlFor={id}
        className={cn("text-[14px] text-[#73738a]", labelClassName)}
      >
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        maxLength={CONTROL_PERIODICITY_MAX_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Например: ежесменно перед началом работы"
        className={cn(
          "min-h-[84px] rounded-2xl border-[#dfe1ec] px-4 py-3 text-[14px] leading-[1.45] transition-colors duration-150 focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15",
          textareaClassName
        )}
      />
      {hint ? <p className="text-[12px] leading-[1.4] text-[#9b9fb3]">{hint}</p> : null}
    </div>
  );
}
