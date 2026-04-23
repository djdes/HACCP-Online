"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { getTelegramWebApp } from "./telegram-web-app";

function resolveQrDestination(text: string): string | null {
  const trimmed = text.trim();

  // Direct Mini App URL
  if (trimmed.includes("/mini/")) {
    try {
      const url = new URL(trimmed);
      if (url.pathname.startsWith("/mini/")) {
        return url.pathname + url.search;
      }
    } catch {
      // Not a full URL — try path-only
      const idx = trimmed.indexOf("/mini/");
      if (idx >= 0) return trimmed.slice(idx);
    }
  }

  // Journal code (e.g. "general_cleaning", "hygiene")
  if (/^[a-z_]+$/.test(trimmed)) {
    return `/mini/journals/${trimmed}`;
  }

  // Equipment ID (UUID or numeric)
  if (/^[0-9a-f-]{36}$/i.test(trimmed) || /^\d+$/.test(trimmed)) {
    return `/mini/equipment?q=${encodeURIComponent(trimmed)}`;
  }

  return null;
}

export function QrScannerButton() {
  const router = useRouter();

  const handleScan = useCallback(() => {
    const tg = getTelegramWebApp();
    if (!tg) {
      alert("Сканер QR доступен только внутри Telegram");
      return;
    }

    try {
      tg.showScanQrPopup(
        { text: "Наведите камеру на QR-код журнала или оборудования" },
        (text: string) => {
          const dest = resolveQrDestination(text);
          if (dest) {
            tg.closeScanQrPopup?.();
            try {
              tg.HapticFeedback?.impactOccurred("medium");
            } catch {}
            router.push(dest);
            return true as unknown as void; // stop scanning
          }
          // Unknown format — keep scanning
          return undefined;
        }
      );
    } catch {
      alert("Не удалось открыть сканер QR. Обновите Telegram.");
    }
  }, [router]);

  return (
    <button
      onClick={handleScan}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm active:bg-slate-50"
      aria-label="Сканировать QR"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h7v7h-7z" />
        <path d="M14 17.5h7M17.5 14v7" />
      </svg>
      Сканировать QR
    </button>
  );
}
