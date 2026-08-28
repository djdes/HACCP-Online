"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function PhotoLightbox({
  url,
  filename,
  caption,
  onClose,
}: {
  url: string;
  filename: string;
  /**
   * Подпись под картинкой. Нужна превью бланков: в полный экран
   * открывается лист без шапки, и без названия непонятно, чей он.
   */
  caption?: string;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white"
        aria-label="Закрыть"
      >
        <X className="size-5" />
      </button>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}
      <div
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={caption ?? filename}
          className="max-h-full min-h-0 max-w-full rounded-lg object-contain"
          onLoad={() => setLoaded(true)}
        />
        {caption ? (
          <div className="max-w-[720px] shrink-0 text-center text-[13px] leading-snug text-white/80">
            {caption}
          </div>
        ) : null}
      </div>
    </div>
  );
}
