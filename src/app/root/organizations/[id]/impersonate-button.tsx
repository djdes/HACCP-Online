"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = { organizationId: string; organizationName: string };

/**
 * Starts a "view as" session. Writes actingAsOrganizationId into the JWT
 * via next-auth update(), then full-reloads to /dashboard so SSR layout
 * перечитывает обновлённый cookie. router.push() + router.refresh() в
 * Next.js 16 не всегда подхватывает свежий JWT — layout рендерится со
 * старым session и юзер видит свой ROOT-контент. Hard reload через
 * window.location.href гарантирует чистую сессию на /dashboard.
 */
export function ImpersonateButton({ organizationId, organizationName }: Props) {
  const { update } = useSession();
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
      // Forces NextAuth to re-issue the JWT with the new claim. await
      // дожидаемся ответа сервера (cookie перезаписан до того как мы
      // перейдём на /dashboard).
      await update({ actingAsOrganizationId: organizationId });
      toast.success(`Вы просматриваете: ${organizationName}`);
      // Hard reload — soft router.push в Next.js 16 кэширует layout с
      // прежним JWT и activeOrgId остаётся = platform.
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
