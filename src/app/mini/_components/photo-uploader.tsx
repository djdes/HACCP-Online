"use client";

import { useCallback, useRef, useState } from "react";

export type PhotoFile = {
  url: string;
  filename: string;
  size: number;
};

export function PhotoUploader({
  entryId,
  onUploaded,
}: {
  entryId?: string;
  onUploaded?: (photo: PhotoFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

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
          return;
        }

        onUploaded?.(data as PhotoFile);
      } catch {
        setError("Network error");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [entryId, onUploaded]
  );

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm active:bg-slate-50 disabled:opacity-50"
      >
        {uploading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Загрузка…
          </>
        ) : (
          <>
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
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Прикрепить фото
          </>
        )}
      </button>
      {error ? <p className="text-[12px] text-red-500">{error}</p> : null}
    </div>
  );
}
