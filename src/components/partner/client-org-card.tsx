"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, Loader2, MapPin, Phone, Save, Search, Users } from "lucide-react";
import { toast } from "sonner";

import { Card, Field, btnOutline, btnPrimary, inputClass, readError } from "@/components/partner/ui";
import { ORG_OWNERSHIP, ORG_SPHERES, sphereLabel } from "@/lib/org-profile";
import { phoneInputProps } from "@/lib/phone-input";
import { innDigits, isValidInn } from "@/lib/inn";
import { cn } from "@/lib/utils";

/**
 * Реквизиты организации клиента прямо на карточке.
 *
 * Что здесь правится — это то, за чем не стоит переключать контекст:
 * название, сфера, ИНН, адрес, телефон, часовой пояс и число точек.
 * Всё остальное — журналы, сотрудники, оформление — по кнопке «Открыть
 * кабинет», где работают обычные настройки организации.
 *
 * Часовой пояс не косметика: от него зависит, что считается «сегодня»,
 * и клиент из Владивостока с московским поясом выглядит вечно
 * просроченным в списке клиентов.
 */

const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: "Europe/Kaliningrad", label: "Калининград (МСК−1)" },
  { value: "Europe/Moscow", label: "Москва (МСК)" },
  { value: "Europe/Samara", label: "Самара (МСК+1)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (МСК+2)" },
  { value: "Asia/Omsk", label: "Омск (МСК+3)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (МСК+4)" },
  { value: "Asia/Irkutsk", label: "Иркутск (МСК+5)" },
  { value: "Asia/Yakutsk", label: "Якутск (МСК+6)" },
  { value: "Asia/Vladivostok", label: "Владивосток (МСК+7)" },
  { value: "Asia/Magadan", label: "Магадан (МСК+8)" },
  { value: "Asia/Kamchatka", label: "Камчатка (МСК+9)" },
];

export type ClientOrgFields = {
  name: string;
  type: string;
  ownershipKind: string;
  inn: string;
  address: string;
  phone: string;
  timezone: string;
  locationsCount: number;
};

export function ClientOrgCard({
  organizationId,
  initial,
  canEdit,
  activeUsersCount,
  usersCount,
  createdAt,
}: {
  organizationId: string;
  initial: ClientOrgFields;
  canEdit: boolean;
  activeUsersCount: number;
  usersCount: number;
  createdAt: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ClientOrgFields>(initial);
  const [busy, setBusy] = useState(false);
  const [innBusy, setInnBusy] = useState(false);

  const dirty = (Object.keys(initial) as Array<keyof ClientOrgFields>).some(
    (key) => form[key] !== initial[key],
  );

  function set<K extends keyof ClientOrgFields>(key: K, value: ClientOrgFields[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /** Подставить название и адрес из ЕГРЮЛ — как в анкете организации. */
  async function lookupByInn() {
    const digits = innDigits(form.inn);
    if (!isValidInn(digits)) {
      toast.error("ИНН — 10 или 12 цифр");
      return;
    }
    setInnBusy(true);
    try {
      const res = await fetch(`/api/public/inn-lookup?inn=${digits}`);
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; name?: string; address?: string }
        | null;
      if (!res.ok || !data?.ok || !data.name) {
        toast.error("По этому ИНН ничего не нашли");
        return;
      }
      setForm((current) => ({
        ...current,
        name: data.name ?? current.name,
        address: data.address ?? current.address,
      }));
      toast.success("Название и адрес подставлены");
    } finally {
      setInnBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      // Только изменённое: роут трактует присланный ключ как «поменять».
      const body: Record<string, unknown> = {};
      for (const key of Object.keys(initial) as Array<keyof ClientOrgFields>) {
        if (form[key] !== initial[key]) body[key] = form[key];
      }
      const res = await fetch(`/api/partner/clients/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Не удалось сохранить"));
        return;
      }
      toast.success("Реквизиты организации обновлены");
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Card
        title="Организация"
        eyebrow="Сведения"
        actions={
          canEdit ? (
            <button type="button" onClick={() => setEditing(true)} className={cn(btnOutline, "h-8 px-3 text-[13px]")}>
              Изменить
            </button>
          ) : null
        }
      >
        <dl className="space-y-3 text-[14px]">
          <Row icon={Building2} label="Сфера" value={sphereLabel(form.type)} />
          <Row icon={Phone} label="Телефон" value={form.phone || "—"} />
          <Row icon={Building2} label="ИНН" value={form.inn || "—"} />
          <Row icon={Users} label="Сотрудники" value={`${activeUsersCount} активных из ${usersCount}`} />
          <Row icon={CalendarDays} label="В WeSetup с" value={createdAt} />
          {form.locationsCount > 1 ? (
            <Row icon={MapPin} label="Точек" value={String(form.locationsCount)} />
          ) : null}
          {form.address ? <Row icon={MapPin} label="Адрес" value={form.address} /> : null}
        </dl>
      </Card>
    );
  }

  return (
    <Card title="Организация" eyebrow="Сведения">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <Field label="Название" required>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputClass}
            maxLength={200}
          />
        </Field>
        <Field label="ИНН" optional hint="Подставим название и адрес из реестра">
          <div className="flex gap-2">
            <input
              value={form.inn}
              onChange={(e) => set("inn", e.target.value.replace(/\D/g, "").slice(0, 12))}
              className={inputClass}
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => void lookupByInn()}
              disabled={innBusy}
              className={cn(btnOutline, "shrink-0")}
            >
              {innBusy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Найти
            </button>
          </div>
        </Field>
        <Field label="Сфера">
          <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputClass}>
            {ORG_SPHERES.map((sphere) => (
              <option key={sphere.value} value={sphere.value}>
                {sphere.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Форма собственности">
          <select
            value={form.ownershipKind}
            onChange={(e) => set("ownershipKind", e.target.value)}
            className={inputClass}
          >
            {ORG_OWNERSHIP.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Адрес" optional>
          <input
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className={inputClass}
            maxLength={500}
          />
        </Field>
        <Field label="Телефон" optional>
          <input
            {...phoneInputProps}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Точек" hint="От двух журналы ведутся отдельно по каждой точке">
          <input
            value={String(form.locationsCount)}
            onChange={(e) => set("locationsCount", Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
            className={inputClass}
            inputMode="numeric"
          />
        </Field>
        <Field label="Часовой пояс" hint="От него зависит, что считается «сегодня» в журналах">
          <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputClass}>
            {TIMEZONES.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !dirty} className={cn(btnPrimary, "disabled:opacity-50")}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {dirty ? "Сохранить" : "Сохранено"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(initial);
              setEditing(false);
            }}
            className={btnOutline}
          >
            Отмена
          </button>
        </div>
      </form>
    </Card>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5566f6]">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-[12px] text-[#6f7282]">{label}</dt>
        <dd className="break-words text-[#0b1024]">{value}</dd>
      </div>
    </div>
  );
}
