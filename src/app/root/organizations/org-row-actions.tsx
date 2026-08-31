"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Действия над организацией прямо в списке.
 *
 * Раньше и вход, и удаление жили только на карточке организации: чтобы
 * убрать тестовую компанию, приходилось сначала в неё зайти. Для разбора
 * десятка мусорных регистраций это десяток лишних переходов.
 */
export function OrgRowActions({
  organizationId,
  organizationName,
  usersCount,
  documentsCount,
}: {
  organizationId: string;
  organizationName: string;
  usersCount: number;
  documentsCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"enter" | "delete" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function enter() {
    setBusy("enter");
    try {
      const response = await fetch("/api/root/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Не удалось войти в организацию");
      }
      // Hard reload: серверные компоненты должны перечитать свежий cookie.
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      const response = await fetch(
        `/api/root/organizations/${organizationId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Не удалось удалить организацию");
      }
      toast.success(`Организация «${organizationName}» удалена`);
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => void enter()}
          disabled={busy !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-50"
        >
          {busy === "enter" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UserCog className="size-3.5 text-[#5566f6]" />
          )}
          Войти
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy !== null}
          aria-label={`Удалить ${organizationName}`}
          className="inline-flex size-9 items-center justify-center rounded-xl text-[#9b9fb3] transition-colors hover:bg-[#fff4f2] hover:text-[#a13a32] disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        variant="danger"
        title={`Удалить «${organizationName}»?`}
        description="Организация и все её данные будут удалены безвозвратно."
        bullets={[
          { label: `Сотрудников: ${usersCount}`, tone: "warn" },
          { label: `Документов журналов: ${documentsCount}`, tone: "warn" },
          { label: "Записи, логи и настройки удалятся вместе с организацией" },
        ]}
        confirmLabel="Удалить"
      />
    </>
  );
}
