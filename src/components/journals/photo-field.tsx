"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

import { compressImageIfWorthwhile } from "@/lib/image-compress";

/**
 * Поле «фото» для журналов.
 *
 * Зачем: по `journal-specs.ts` четыре журнала требуют фото
 * (`pest_control`, `product_writeoff`, `equipment_calibration`,
 * `accident_journal`) и ещё одиннадцать его рекомендуют — но типа поля
 * `photo` не существовало ни в `DynamicForm`, ни в `TaskFormField`.
 * В `/mini/claim` бейдж «Требуется фото» был вовсе декоративным: за ним
 * не стояло загрузчика.
 *
 * Снимок сжимается на клиенте перед отправкой (повар снимает 3-4 МБ, а
 * связь на кухне сотовая) и уходит в тот же `/api/mini/attachments`,
 * что и вложения Mini App — эндпоинту достаточно обычной сессии, он не
 * привязан к Telegram.
 *
 * Значение поля — строка с URL'ами через `\n`: так оно переживает
 * `TaskFormValues`, где допустимы только строка, число и булево.
 */
export const PHOTO_VALUE_SEPARATOR = "\n";

export function parsePhotoValue(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  return raw.split(PHOTO_VALUE_SEPARATOR).map((item) => item.trim()).filter(Boolean);
}

export function PhotoField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = parsePhotoValue(value);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImageIfWorthwhile(file);
      const form = new FormData();
      form.append("file", compressed ?? file);

      const response = await fetch("/api/mini/attachments", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        setError(data?.error || "Не удалось загрузить фото");
        return;
      }
      onChange([...urls, String(data.url)].join(PHOTO_VALUE_SEPARATOR));
    } catch {
      setError("Нет связи — попробуйте ещё раз");
    } finally {
      setUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(
      urls.filter((_, i) => i !== index).join(PHOTO_VALUE_SEPARATOR)
    );
  }

  const missing = required && urls.length === 0;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[12px] font-medium text-[#6f7282]">{label}</span>
        {required ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              missing
                ? "bg-[#fff4f2] text-[#a13a32]"
                : "bg-[#ecfdf5] text-[#116b2a]"
            }`}
          >
            {missing ? "обязательно" : "есть"}
          </span>
        ) : null}
      </div>

      {urls.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative size-20 overflow-hidden rounded-2xl border border-[#ececf4] bg-[#fafbff]"
            >
              {/* Обычный <img>: файлы лежат в /uploads и не проходят через
                  оптимизатор Next, а размер тут фиксированный. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Фото ${index + 1}`}
                className="size-full object-cover"
              />
              {!disabled ? (
                <button
                  type="button"
                  aria-label="Удалить фото"
                  onClick={() => removeAt(index)}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-[#0b1024]/60 text-white transition-colors hover:bg-[#0b1024]/80"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) await upload(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-[14px] font-medium transition-colors duration-150 disabled:opacity-60 ${
          missing
            ? "border-[#e0857d] bg-[#fff4f2] text-[#a13a32] hover:bg-[#ffe9e5]"
            : "border-[#dcdfed] bg-white text-[#3848c7] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        }`}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Camera className="size-4" />
        )}
        {uploading ? "Загружаем…" : urls.length > 0 ? "Ещё фото" : "Снять фото"}
      </button>

      {error ? (
        <div className="mt-1 text-[12px] font-medium text-[#a13a32]">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-[12px] text-[#9b9fb3]">{hint}</div>
      ) : null}
    </div>
  );
}
