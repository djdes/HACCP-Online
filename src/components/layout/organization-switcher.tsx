"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ORG_SPHERES } from "@/lib/org-profile";
import type { AccessibleOrganization } from "@/lib/organization-access";

/**
 * Список организаций аккаунта в меню профиля + создание новой точки.
 *
 * Страницы остаются одно-организационными: мы не сводим данные разных
 * точек в один экран, а переключаем активную. Так проще и честнее —
 * журнал, задача и сотрудник всегда принадлежат одному объекту.
 */

export function OrganizationSwitcher({
  organizations,
  activeId,
  canCreate,
  currentSphere,
}: {
  organizations: AccessibleOrganization[];
  activeId: string;
  canCreate: boolean;
  currentSphere: string;
}) {
  const router = useRouter();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Одна организация и создавать нельзя — показывать нечего.
  if (organizations.length < 2 && !canCreate) return null;

  async function switchTo(organization: AccessibleOrganization) {
    if (organization.id === activeId) return;
    setSwitchingId(organization.id);
    try {
      const response = await fetch("/api/me/active-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось переключиться");
      toast.success(`Переключено: ${organization.name}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <>
      <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9b9fb3]">
        Организации
      </div>
      {organizations.map((organization) => {
        const active = organization.id === activeId;
        return (
          <button
            key={organization.id}
            type="button"
            onClick={() => switchTo(organization)}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[14px] transition-colors ${
              active
                ? "bg-[#f5f6ff] text-[#0b1024]"
                : "text-[#3c4053] hover:bg-[#f5f6ff]"
            }`}
          >
            <Building2 className="size-4 shrink-0 text-[#9b9fb3]" />
            <span className="min-w-0 flex-1 truncate">{organization.name}</span>
            {switchingId === organization.id ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-[#5566f6]" />
            ) : active ? (
              <Check className="size-4 shrink-0 text-[#5566f6]" />
            ) : null}
          </button>
        );
      })}

      {canCreate ? (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[14px] text-[#5566f6] transition-colors hover:bg-[#f5f6ff]"
        >
          <Plus className="size-4 shrink-0" />
          Добавить организацию
        </button>
      ) : null}

      {createOpen ? (
        <CreateOrganizationDialog
          currentSphere={currentSphere}
          currentName={
            organizations.find((item) => item.id === activeId)?.name ?? ""
          }
          onClose={() => setCreateOpen(false)}
          organizationsCount={organizations.length}
        />
      ) : null}
    </>
  );
}

function CreateOrganizationDialog({
  currentSphere,
  currentName,
  organizationsCount,
  onClose,
}: {
  currentSphere: string;
  currentName: string;
  organizationsCount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sphere, setSphere] = useState(currentSphere);
  const [copy, setCopy] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sphere,
          // Копируем структуру текущей точки: у сети должности и набор
          // журналов почти всегда одинаковые, и набивать их заново —
          // самая скучная часть открытия второго заведения.
          copyFrom: copy ? "current" : undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось создать");
      toast.success(`Организация «${name.trim()}» создана`);
      onClose();
      router.push("/dashboard?welcome-org=1");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0b1024]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[440px] rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_30px_80px_-30px_rgba(11,16,36,0.5)]"
      >
        <h2 className="text-[18px] font-semibold text-[#0b1024]">
          Новая организация
        </h2>
        <p className="mt-1 text-[13px] text-[#6f7282]">
          Отдельная точка со своими сотрудниками, журналами и задачами.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#3c4053]">
            Название
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            placeholder="Кафе на Ленина"
            maxLength={200}
            className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-[13px] font-medium text-[#3c4053]">
            Сфера
          </span>
          <select
            value={sphere}
            onChange={(event) => setSphere(event.target.value)}
            className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          >
            {ORG_SPHERES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {currentName ? (
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-[#f5f6ff] p-3">
            <input
              type="checkbox"
              checked={copy}
              onChange={(event) => setCopy(event.target.checked)}
              className="mt-0.5 size-4 accent-[#5566f6]"
            />
            <span className="text-[13px] leading-snug text-[#3c4053]">
              Скопировать должности и набор журналов из «{currentName}».
              Сотрудников не переносим.
            </span>
          </label>
        ) : null}

        <p className="mt-3 text-[12px] text-[#9b9fb3]">
          После создания: {organizationsCount + 1} организации · лимит
          сотрудников общий на аккаунт.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-2xl px-4 text-[15px] text-[#6f7282] transition-colors hover:bg-[#f5f6ff]"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving || name.trim().length < 2}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#c9cef7]"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Создать и перейти
          </button>
        </div>
      </form>
    </div>
  );
}
