"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card, Field, btnOutline, btnPrimary, inputClass, readError } from "@/components/partner/ui";
import { innDigits, isValidInn } from "@/lib/inn";
import { ORG_OWNERSHIP, ORG_SPHERES } from "@/lib/org-profile";
import { phoneInputProps } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

/**
 * Новая организация клиента.
 *
 * Обязательное здесь — только название и сфера: консультант заводит
 * заведение, чтобы сразу начать его настраивать, а реквизиты соберёт
 * по ходу. ИНН подтягивает название и адрес из реестра, поэтому стоит
 * первым — с него анкета заполняется почти целиком.
 *
 * Владелец необязателен. Без него организация остаётся «не переданной»:
 * консультант настраивает её один, а приглашение отправляет позже с
 * карточки клиента.
 */
export function CreateClientForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [innBusy, setInnBusy] = useState(false);

  const [inn, setInn] = useState("");
  const [name, setName] = useState("");
  const [sphere, setSphere] = useState("restaurant");
  const [ownershipKind, setOwnershipKind] = useState("private");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [locationsCount, setLocationsCount] = useState(1);

  const [withOwner, setWithOwner] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  async function lookupByInn() {
    const digits = innDigits(inn);
    if (!isValidInn(digits)) {
      toast.error("ИНН — 10 или 12 цифр");
      return;
    }
    setInnBusy(true);
    try {
      const res = await fetch(`/api/public/inn-lookup?inn=${digits}`);
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; name?: string; address?: string; sphere?: string | null; ownershipKind?: string | null }
        | null;
      if (!res.ok || !data?.ok || !data.name) {
        toast.error("По этому ИНН ничего не нашли — заполните вручную");
        return;
      }
      setName((current) => current.trim() || data.name || "");
      if (data.address) setAddress((current) => current.trim() || data.address || "");
      if (data.sphere) setSphere(data.sphere);
      if (data.ownershipKind) setOwnershipKind(data.ownershipKind);
      toast.success("Данные из реестра подставлены");
    } finally {
      setInnBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/partner/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sphere,
          ownershipKind,
          inn,
          address,
          phone,
          locationsCount,
          owner: withOwner ? { email: ownerEmail, name: ownerName, phone: ownerPhone } : null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { organizationId?: string } | null;
      if (!res.ok || !data?.organizationId) {
        toast.error(await readError(res, "Не удалось создать организацию"));
        return;
      }
      toast.success(
        withOwner
          ? `«${name}» создана, приглашение отправлено на ${ownerEmail}`
          : `«${name}» создана — можно настраивать`,
      );
      router.push(`/partner/clients/${data.organizationId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="space-y-5"
    >
      <Card title="Заведение" eyebrow="Шаг 1">
        <div className="space-y-4">
          <Field label="ИНН" optional hint="Подставим название, адрес и сферу из реестра">
            <div className="flex gap-2">
              <input
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, "").slice(0, 12))}
                className={inputClass}
                inputMode="numeric"
                placeholder="7712345678"
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

          <Field label="Название" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Кафе «Ромашка»"
              maxLength={200}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сфера" required>
              <select value={sphere} onChange={(e) => setSphere(e.target.value)} className={inputClass}>
                {ORG_SPHERES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Форма собственности">
              <select
                value={ownershipKind}
                onChange={(e) => setOwnershipKind(e.target.value)}
                className={inputClass}
              >
                {ORG_OWNERSHIP.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Адрес" optional>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
                maxLength={500}
              />
            </Field>
            <Field label="Телефон" optional>
              <input
                {...phoneInputProps}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Точек" hint="От двух журналы ведутся отдельно по каждой">
              <input
                value={String(locationsCount)}
                onChange={(e) => setLocationsCount(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                className={inputClass}
                inputMode="numeric"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Владелец" eyebrow="Шаг 2">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setWithOwner(false)}
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150",
              !withOwner
                ? "border-[#5566f6] bg-[#f5f6ff]"
                : "border-[#dcdfed] bg-white hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl",
                !withOwner ? "bg-[#5566f6] text-white" : "bg-[#eef1ff] text-[#5566f6]",
              )}
            >
              <Sparkles className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#0b1024]">Настрою сам, передам позже</span>
              <span className="block text-[12px] leading-[1.45] text-[#6f7282]">
                Рекомендуем: сначала журналы и сотрудники, потом приглашение
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setWithOwner(true)}
            className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150",
              withOwner
                ? "border-[#5566f6] bg-[#f5f6ff]"
                : "border-[#dcdfed] bg-white hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl",
                withOwner ? "bg-[#5566f6] text-white" : "bg-[#eef1ff] text-[#5566f6]",
              )}
            >
              <Building2 className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#0b1024]">Пригласить сразу</span>
              <span className="block text-[12px] leading-[1.45] text-[#6f7282]">
                Клиенту уйдёт письмо, он задаст пароль и станет руководителем
              </span>
            </span>
          </button>
        </div>

        {withOwner ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Почта владельца" required>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className={inputClass}
                placeholder="director@example.ru"
                maxLength={160}
                required
              />
            </Field>
            <Field label="Имя" required>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={inputClass}
                placeholder="Иван Петров"
                maxLength={120}
                required
              />
            </Field>
            <Field
              label="Телефон владельца"
              optional
              hint="Без него при первом входе клиент увидит анкету регистрации поверх готового кабинета"
              className="sm:col-span-2"
            >
              <input
                {...phoneInputProps}
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        ) : (
          <p className="mt-4 text-[13px] leading-[1.55] text-[#6f7282]">
            Организация появится в списке клиентов с пометкой «не передана». Настраивайте её как свою, а когда
            будет готово — отправьте приглашение владельцу с карточки клиента. Подписку с этого момента оплачивает
            он, а не вы.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={cn(btnPrimary, "disabled:opacity-50")}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
          Создать организацию
        </button>
      </div>
    </form>
  );
}
