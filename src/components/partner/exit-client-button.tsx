"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { btnOutline } from "@/components/partner/ui";

/** «Выйти из кабинета клиента»: снимает partnerAccess-claim и ведёт в кабинет партнёра. */
export function ExitClientButton({ label = "Выйти из кабинета клиента" }: { label?: string }) {
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    try {
      const res = await fetch("/api/partner/exit", { method: "POST" });
      if (!res.ok) throw new Error("Не удалось выйти из кабинета клиента");
      window.location.href = "/partner";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось выйти");
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={exit} disabled={busy} className={btnOutline}>
      <LogOut className="size-4 text-[#5566f6]" />
      {busy ? "Выходим…" : label}
    </button>
  );
}
