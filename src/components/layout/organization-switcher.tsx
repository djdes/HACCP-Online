"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AccessibleOrganization } from "@/lib/organization-access";
import { CreateOrganizationDialog } from "@/components/layout/create-organization-dialog";

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
  label = "Организации",
}: {
  organizations: AccessibleOrganization[];
  activeId: string;
  canCreate: boolean;
  currentSphere: string;
  /** Заголовок группы: в меню профиля «Организации», в nav-пилюле — «Сменить организацию». */
  label?: string;
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
        {label}
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
