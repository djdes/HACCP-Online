"use client";

import { useState } from "react";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = { organizationId: string; organizationName: string };

/**
 * Starts a "view as" session. /api/root/impersonate сам перевыпускает
 * NextAuth session-token cookie с новым actingAsOrganizationId — нам
 * не нужен useSession().update() (он ненадёжен в Next.js 16 + NextAuth
 * v4: cookie иногда не записывается до hard navigation). После успеха
 * делаем full reload на /dashboard — layout видит обновлённый JWT и
 * рендерится в контексте выбранной организации.
 */
export function ImpersonateButton({ organizationId, organizationName }: Props) {
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const res = await fetch("/api/root/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Не удалось начать impersonation");
      }
      toast.success(`Вы просматриваете: ${organizationName}`);
      // Hard reload гарантирует что server-side getServerSession()
      // перечитает свежий cookie на /dashboard.
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось войти в организацию"
      );
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={start}
      disabled={busy}
      className="h-11 rounded-2xl bg-[#5566f6] px-4 text-[15px] text-white hover:bg-[#4959eb]"
    >
      <UserCog className="size-5" />
      Войти как {organizationName}
    </Button>
  );
}
