"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = { organizationId: string; organizationName: string };

/**
 * ROOT-only удаление организации со всеми зависимостями.
 *
 * Подтверждение — `ConfirmDialog`, а не `window.prompt`: нативная
 * промптилка выглядит чужеродно и на телефоне обрезает текст, из-за чего
 * человек не дочитывает, что именно удаляется.
 */
export function DeleteOrgButton({ organizationId, organizationName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/root/organizations/${organizationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Не удалось удалить организацию");
      }
      toast.success(`Организация «${organizationName}» удалена.`);
      setConfirmOpen(false);
      router.push("/root");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Button
      type="button"
      onClick={() => setConfirmOpen(true)}
      disabled={busy}
      variant="outline"
      className="h-11 rounded-2xl border-[#fecaca] bg-white px-4 text-[14px] text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      Удалить организацию
    </Button>

    <ConfirmDialog
      open={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
      variant="danger"
      title={`Удалить «${organizationName}»?`}
      description="Организация и все её данные будут удалены безвозвратно."
      bullets={[
        { label: "Сотрудники, журналы, документы и логи — вместе с ней", tone: "warn" },
        { label: "Восстановить не получится" },
      ]}
      confirmLabel="Удалить"
    />
    </>
  );
}
