"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
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
      className="inline-flex items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-3 py-2 text-[13px] font-medium text-[#0b1024] shadow-sm active:scale-[0.98] active:bg-[#f5f6ff]"
      aria-label="Сканировать QR"
    >
      <QrCode className="size-4 text-[#5566f6]" />
      Сканировать QR
    </button>
  );
}
