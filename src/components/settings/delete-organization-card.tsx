"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Карточка «Удалить организацию»: подтверждение вводом названия, 30 дней холда. */
export function DeleteOrganizationCard({ organizationName, deletionRequestedAt }: { organizationName: string; deletionRequestedAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function request() {
    setBusy(true);
    try {
      const response = await fetch("/api/settings/organization/deletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmName: organizationName }) });
      const data = (await response.json().catch(() => null)) as { error?: string; dueAt?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Не удалось запланировать удаление");
      toast.success("Удаление запланировано — отменить можно в любой момент до срока");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="delete" className="rounded-3xl border border-[#ffd2cd] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-[#a13a32]">
        <Trash2 className="size-4" />
        Удалить организацию
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6f7282]">
        Все журналы, документы, сотрудники и настройки будут удалены безвозвратно через 30 дней после запроса. До этого дня удаление можно отменить — баннер будет виден всем в организации. Перед удалением выгрузите архив журналов в «Настройки → Бэкап».
      </p>
      {deletionRequestedAt ? (
        <p className="mt-3 rounded-2xl bg-[#fff4f2] px-3.5 py-2.5 text-[13px] text-[#a13a32]">Удаление уже запланировано — отменить можно из баннера сверху страницы.</p>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#d2453d] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(210,69,61,0.55)] transition-colors hover:bg-[#b93b34]" data-testid="delete-org-button">
          <Trash2 className="size-4" />
          Запланировать удаление
        </button>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        variant="danger"
        title="Удалить организацию через 30 дней?"
        description="Введите название организации, чтобы подтвердить."
        bullets={[{ label: "Журналы, документы, сотрудники и настройки будут удалены" }, { label: "30 дней на отмену — баннер в кабинете и письмо руководству" }, { label: "Подписка не возвращается" }]}
        typeToConfirm={organizationName}
        confirmLabel="Запланировать удаление"
        onConfirm={request}
        confirmDisabled={busy}
      />
    </section>
  );
}
