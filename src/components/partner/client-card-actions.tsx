"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, PencilLine, Unlink } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { PartnerAccessLevel } from "@/lib/partners/access-guard";
import { btnDanger, btnPrimary, readError } from "@/components/partner/ui";

/**
 * Кнопки карточки клиента: «Открыть кабинет» (ставит claim partnerAccess
 * и уводит в /dashboard клиента) и «Отключить сопровождение» (с
 * подтверждением и перечнем последствий).
 */
export function ClientCardActions({
  organizationId,
  organizationName,
  accessLevel,
  detached,
}: {
  organizationId: string;
  organizationName: string;
  accessLevel: PartnerAccessLevel;
  detached: boolean;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function openCabinet() {
    setOpening(true);
    try {
      const res = await fetch(`/api/partner/clients/${organizationId}/open`, { method: "POST" });
      if (!res.ok) {
        toast.error(await readError(res, "Не удалось открыть кабинет"));
        return;
      }
      // Полная перезагрузка — новая JWT-кука должна дойти до middleware.
      window.location.href = "/dashboard";
    } catch {
      toast.error("Нет связи с сервером");
    } finally {
      setOpening(false);
    }
  }

  async function detach() {
    const res = await fetch(`/api/partner/clients/${organizationId}/detach`, { method: "POST" });
    if (!res.ok) {
      toast.error(await readError(res, "Не удалось отключить"));
      return;
    }
    toast.success(`Сопровождение «${organizationName}» отключено`);
    setConfirmOpen(false);
    router.refresh();
  }

  if (detached) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btnPrimary} onClick={openCabinet} disabled={opening}>
        {accessLevel === "edit" ? <PencilLine className="size-4" /> : <Eye className="size-4" />}
        {opening ? "Открываем…" : "Открыть кабинет"}
        <ExternalLink className="size-3.5 opacity-70" />
      </button>
      <button type="button" className={btnDanger} onClick={() => setConfirmOpen(true)}>
        <Unlink className="size-4" />
        Отключить
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={detach}
        variant="danger"
        title={`Отключить сопровождение «${organizationName}»?`}
        description="Клиент получит письмо. Историю заметок и начислений мы сохраним."
        bullets={[
          { label: "Доступ в кабинет клиента пропадёт сразу", tone: "warn" },
          { label: "Ваш брендинг у клиента вернётся к стандартному WeSetup" },
          { label: "Новые начисления по этому клиенту прекратятся", tone: "warn" },
          { label: "Подключить заново клиент сможет по вашей ссылке или коду", tone: "info" },
        ]}
        confirmLabel="Отключить"
        typeToConfirm="ОТКЛЮЧИТЬ"
      />
    </div>
  );
}
