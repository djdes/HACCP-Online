"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Field, btnPrimary, inputClass, readError } from "@/components/partner/ui";
import { cn } from "@/lib/utils";

export type PayoutTypeValue = "ip" | "self_employed" | "company";

export type PayoutFormValue = {
  payoutType: PayoutTypeValue | null;
  details: {
    fullName: string;
    inn: string;
    bank: string;
    bik: string;
    account: string;
    kpp: string;
    ogrn: string;
  };
};

const TYPE_OPTIONS: { value: PayoutTypeValue; label: string; hint: string }[] = [
  { value: "self_employed", label: "Самозанятый", hint: "ИНН 12 цифр, чек через «Мой налог»" },
  { value: "ip", label: "ИП", hint: "ИНН 12 цифр, ОГРНИП" },
  { value: "company", label: "Юрлицо", hint: "ИНН 10 цифр, КПП, ОГРН" },
];

export function emptyPayoutForm(): PayoutFormValue {
  return {
    payoutType: null,
    details: { fullName: "", inn: "", bank: "", bik: "", account: "", kpp: "", ogrn: "" },
  };
}

/**
 * Реквизиты для выплат (ИП / самозанятый / юрлицо). Меняет только
 * владелец партнёра — участнику команды форма показывается заблокированной.
 */
export function PayoutForm({
  initial,
  canEdit,
  onSaved,
}: {
  initial: PayoutFormValue;
  canEdit: boolean;
  onSaved?: (value: PayoutFormValue) => void;
}) {
  const [value, setValue] = useState<PayoutFormValue>(initial);
  const [saving, setSaving] = useState(false);
  const type = value.payoutType;

  function setDetail(key: keyof PayoutFormValue["details"], v: string) {
    setValue((prev) => ({ ...prev, details: { ...prev.details, [key]: v } }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!type) {
      toast.error("Выберите тип получателя");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/partner/payout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutType: type, details: value.details }),
      });
      if (!res.ok) throw new Error(await readError(res, "Не удалось сохранить реквизиты"));
      toast.success("Реквизиты сохранены");
      onSaved?.(value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить реквизиты");
    } finally {
      setSaving(false);
    }
  }

  const isCompany = type === "company";
  const isSelfEmployed = type === "self_employed";

  return (
    <form onSubmit={save} className="space-y-5">
      <fieldset disabled={!canEdit} className="space-y-5">
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-[#3c4053]">Тип получателя</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue((prev) => ({ ...prev, payoutType: opt.value }))}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors duration-150",
                    active
                      ? "border-[#5566f6] bg-[#f5f6ff] ring-4 ring-[#5566f6]/10"
                      : "border-[#dcdfed] bg-white hover:border-[#5566f6]/40 hover:bg-[#fafbff]",
                  )}
                  aria-pressed={active}
                >
                  <div className="text-[14px] font-medium text-[#0b1024]">{opt.label}</div>
                  <div className="text-[12px] text-[#6f7282]">{opt.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        {type ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={isCompany ? "Название юрлица" : "ФИО получателя"} className="md:col-span-2">
              <input className={inputClass} value={value.details.fullName} onChange={(e) => setDetail("fullName", e.target.value)} required />
            </Field>
            <Field label="ИНН" hint={isCompany ? "10 цифр" : "12 цифр"}>
              <input
                className={inputClass}
                inputMode="numeric"
                value={value.details.inn}
                maxLength={isCompany ? 10 : 12}
                onChange={(e) => setDetail("inn", e.target.value.replace(/\D/g, ""))}
                required
              />
            </Field>
            {isCompany ? (
              <Field label="КПП" hint="9 цифр">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={value.details.kpp}
                  maxLength={9}
                  onChange={(e) => setDetail("kpp", e.target.value.replace(/\D/g, ""))}
                  required
                />
              </Field>
            ) : null}
            {!isSelfEmployed ? (
              <Field label={isCompany ? "ОГРН" : "ОГРНИП"} hint={isCompany ? "13 цифр, необязательно" : "15 цифр, необязательно"}>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={value.details.ogrn}
                  maxLength={isCompany ? 13 : 15}
                  onChange={(e) => setDetail("ogrn", e.target.value.replace(/\D/g, ""))}
                />
              </Field>
            ) : null}
            <Field label="Банк" className={isSelfEmployed ? "md:col-span-1" : undefined}>
              <input className={inputClass} value={value.details.bank} onChange={(e) => setDetail("bank", e.target.value)} required />
            </Field>
            <Field label="БИК" hint="9 цифр">
              <input
                className={inputClass}
                inputMode="numeric"
                value={value.details.bik}
                maxLength={9}
                onChange={(e) => setDetail("bik", e.target.value.replace(/\D/g, ""))}
                required
              />
            </Field>
            <Field label="Расчётный счёт" hint="20 цифр" className="md:col-span-2">
              <input
                className={cn(inputClass, "font-mono")}
                inputMode="numeric"
                value={value.details.account}
                maxLength={20}
                onChange={(e) => setDetail("account", e.target.value.replace(/\D/g, ""))}
                required
              />
            </Field>
          </div>
        ) : null}
      </fieldset>

      {canEdit ? (
        <div className="flex justify-end">
          <button type="submit" className={btnPrimary} disabled={saving || !type}>
            <Save className="size-4" />
            {saving ? "Сохраняем…" : "Сохранить реквизиты"}
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-[#6f7282]">Реквизиты может менять только владелец партнёрского аккаунта.</p>
      )}
    </form>
  );
}
