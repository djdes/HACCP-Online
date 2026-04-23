"use client";

import { useNetwork } from "../_hooks/use-network";
import { useEffect, useState } from "react";
import { syncQueue } from "../_lib/offline";

export function OfflineIndicator() {
  const isOnline = useNetwork();
  const [showSynced, setShowSynced] = useState(false);

  useEffect(() => {
    if (isOnline) {
      void (async () => {
        const result = await syncQueue();
        if (result.succeeded > 0) {
          setShowSynced(true);
          setTimeout(() => setShowSynced(false), 3000);
        }
      })();
    }
  }, [isOnline]);

  if (isOnline && !showSynced) return null;

  return (
    <div
      className={`fixed left-1/2 top-2 z-[60] -translate-x-1/2 rounded-full px-4 py-1.5 text-[12px] font-medium shadow-lg transition-all ${
        isOnline
          ? "bg-emerald-500 text-white"
          : "bg-amber-500 text-white"
      }`}
    >
      {isOnline
        ? `Синхронизировано ${showSynced ? "✓" : ""}`
        : "⚠ Нет связи — действия сохранятся и отправятся позже"}
    </div>
  );
}
