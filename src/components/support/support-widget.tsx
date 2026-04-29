"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Floating-виджет поддержки в углу dashboard'а. Менеджер пишет
 * сообщение → POST /api/support → команда WeSetup получает в
 * Telegram-канал и отвечает в течение 4 ч в рабочее время.
 *
 * Дизайн: компактный FAB слева внизу (чтобы не конфликтовать с AI
 * виджетом справа). Открывается в небольшую sheet'у с textarea.
 */
export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      toast.error("Сообщение слишком короткое");
      return;
    }
    setBusy(true);
    try {
      const url =
        typeof window !== "undefined" ? window.location.href : undefined;
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, url }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Ошибка");
      }
      toast.success(
        "Сообщение получено. Команда WeSetup ответит в течение 4 часов в рабочее время."
      );
      setMessage("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-[68px] z-30 flex size-11 items-center justify-center rounded-full bg-white text-[#5566f6] shadow-[0_10px_24px_-10px_rgba(11,16,36,0.25)] ring-1 ring-[#ececf4] transition-all hover:scale-105"
        aria-label="Поддержка"
        title="Поддержка"
      >
        <MessageCircle className="size-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_30px_80px_-20px_rgba(11,16,36,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[#0b1024]">
            Связаться с поддержкой
          </div>
          <p className="mt-1 text-[12px] text-[#6f7282]">
            Команда WeSetup отвечает в Telegram в течение 4 часов в
            рабочее время.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-[#9b9fb3] hover:bg-[#fafbff]"
          aria-label="Закрыть"
        >
          <X className="size-4" />
        </button>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Опишите проблему или вопрос..."
        rows={5}
        maxLength={2000}
        disabled={busy}
        className="mt-4 w-full rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-3 py-2 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#9b9fb3]">
          {message.length}/2000
        </span>
        <button
          type="button"
          onClick={send}
          disabled={busy || message.trim().length < 5}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white hover:bg-[#4a5bf0] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Отправить
        </button>
      </div>
    </div>
  );
}
