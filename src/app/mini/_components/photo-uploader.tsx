"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { haptic } from "./use-haptic";

export type PhotoFile = {
  url: string;
  filename: string;
  size: number;
};

type Source = "camera" | "gallery";

/**
 * Native bottom-sheet pattern: тап «прикрепить» → sheet с двумя пунктами:
 * камера / галерея. Каждый пункт триггерит свой `<input>` с
 * правильными атрибутами:
 *  - камера   → accept="image/*" capture="environment" (на iOS открывает
 *               сразу заднюю камеру, без галереи).
 *  - галерея  → accept="image/*" без capture (галерея без камеры).
 *
 * iOS Safari и так умеет показывать native action-sheet для одного `<input>`
 * с capture, но (а) не на всех клиентах Telegram WebApp пользовательский
 * выбор работает, и (б) UX без явных подписей хуже на Android. Свой sheet
 * работает одинаково везде.
 *
 * PDF/документ — отдельный пункт умышленно не делаем: API
 * `/api/mini/attachments` whitelistит только image/jpeg|png|webp с cap'ом
 * 5MB. Если пользователь выберет PDF, бэкенд вернёт 400 и пользователь
 * увидит «Upload failed» без объяснения. Лучше не предлагать.
 */
export function PhotoUploader({
  entryId,
  onUploaded,
}: {
  entryId?: string;
  onUploaded?: (photo: PhotoFile) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        if (entryId) form.append("entryId", entryId);

        const res = await fetch("/api/mini/attachments", {
          method: "POST",
          body: form,
        });

        const data = await res.json().catch(() => ({ error: "Upload failed" }));
        if (!res.ok) {
          setError(data.error || "Upload failed");
          haptic("error");
          return;
        }
        onUploaded?.(data as PhotoFile);
        haptic("success");
      } catch {
        setError("Network error");
        haptic("error");
      } finally {
        setUploading(false);
      }
    },
    [entryId, onUploaded]
  );

  const handleFile =
    (resetRef: React.RefObject<HTMLInputElement | null>) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await upload(file);
      if (resetRef.current) resetRef.current.value = "";
    };

  function pick(source: Source) {
    haptic("light");
    setSheetOpen(false);
    // setTimeout(0) даёт sheet'у закрыться (иначе нативный picker иногда
    // открывается на фоне исчезающего overlay'я и UX становится дёрганым).
    setTimeout(() => {
      if (source === "camera") cameraRef.current?.click();
      else galleryRef.current?.click();
    }, 50);
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile(cameraRef)}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handleFile(galleryRef)}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => {
          haptic("light");
          setSheetOpen(true);
        }}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm active:bg-slate-50 disabled:opacity-50"
      >
        {uploading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Загрузка…
          </>
        ) : (
          <>
            <Camera className="size-4" />
            Прикрепить фото
          </>
        )}
      </button>
      {error ? <p className="text-[12px] text-red-500">{error}</p> : null}

      {sheetOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3"
          role="dialog"
          aria-modal="true"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0b0f] p-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Источник
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-full p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </div>
            <SheetItem
              icon={Camera}
              label="Камера"
              hint="Сделать фото прямо сейчас"
              onClick={() => pick("camera")}
            />
            <SheetItem
              icon={ImageIcon}
              label="Галерея"
              hint="Уже снятое фото из библиотеки"
              onClick={() => pick("gallery")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SheetItem({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Camera;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-white transition-colors hover:bg-white/5"
    >
      <span className="flex size-10 items-center justify-center rounded-2xl bg-white/8 text-white">
        <Icon className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-medium">{label}</span>
        <span className="text-[12px] text-white/45">{hint}</span>
      </span>
    </button>
  );
}
