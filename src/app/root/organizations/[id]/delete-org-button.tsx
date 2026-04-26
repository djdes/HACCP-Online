"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = { organizationId: string; organizationName: string };

/**
 * ROOT-only удаление организации со всеми зависимостями. Двойное
 * подтверждение через `prompt`-ввод названия — защита от случайного
 * клика. После успеха редирект на /root.
 */
export function DeleteOrgButton({ organizationId, organizationName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const confirmName = window.prompt(
      `Удалить организацию «${organizationName}» вместе со всеми сотрудниками, журналами, документами и логами?\n\nЭто необратимо. Введите название организации для подтверждения:`
    );
    if (confirmName === null) return; // пользователь нажал «отмена»
    if (confirmName.trim() !== organizationName.trim()) {
      toast.error("Название не совпало — отменено.");
      return;
    }
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
      router.push("/root");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={remove}
      disabled={busy}
      variant="outline"
      className="h-11 rounded-2xl border-[#fecaca] bg-white px-4 text-[14px] text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      Удалить организацию
    </Button>
  );
}
