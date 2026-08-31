"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Удаление организации с подтверждением.
 *
 * Общий компонент для списка организаций и таблицы метрик: подтверждение
 * необратимого действия не должно существовать в двух вариантах — второй
 * рано или поздно отстанет и начнёт врать о последствиях.
 */
export function OrgDeleteButton({
  organizationId,
  organizationName,
  usersCount,
  documentsCount,
  disabled = false,
}: {
  organizationId: string;
  organizationName: string;
  /** Показываем в подтверждении, если вызывающий знает цифры. */
  usersCount?: number;
  documentsCount?: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    setBusy(true);
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
      setBusy(false);
    }
  }

  const bullets = [
    typeof usersCount === "number"
      ? { label: `Сотрудников: ${usersCount}`, tone: "warn" as const }
      : null,
    typeof documentsCount === "number"
      ? { label: `Документов журналов: ${documentsCount}`, tone: "warn" as const }
      : null,
    {
      label: "Записи, логи и настройки удалятся вместе с организацией",
      tone: "default" as const,
    },
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || busy}
        aria-label={`Удалить ${organizationName}`}
        title="Удалить организацию"
        className="inline-flex size-9 items-center justify-center rounded-xl text-[#9b9fb3] transition-colors hover:bg-[#fff4f2] hover:text-[#a13a32] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        variant="danger"
        title={`Удалить «${organizationName}»?`}
        description="Организация и все её данные будут удалены безвозвратно."
        bullets={bullets}
        confirmLabel="Удалить"
      />
    </>
  );
}
