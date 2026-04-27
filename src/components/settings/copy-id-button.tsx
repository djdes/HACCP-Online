"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

type Props = {
  id: string;
  label?: string;
  /** Подсказка-tooltip и aria-label */
  hint?: string;
};

/**
 * Маленькая кнопка-«Скопировать ID» для админских таблиц.
 * Используется на /settings/equipment, /settings/users и т.п. — когда
 * нужно быстро получить cuid для DIY-датчика, скрипта или
 * dev-консоли.
 */
export function CopyIdButton({ id, hint = "Скопировать ID" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("ID скопирован");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={hint}
      aria-label={hint}
      className="inline-flex size-8 items-center justify-center rounded-lg text-[#9b9fb3] transition-colors hover:bg-[#f5f6ff] hover:text-[#3848c7]"
    >
      {copied ? (
        <Check className="size-4 text-[#116b2a]" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}
