"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

/**
 * «Проверить уведомления» — владелец жмёт кнопку и своими глазами видит,
 * в какой Telegram и на какую почту приходят служебные сообщения
 * платформы. До этого он мог только гадать, чей chat id прописан в env.
 */
export function TestNotifyButton({
  chatIdsMasked,
  emailMasked,
}: {
  chatIdsMasked: string[];
  emailMasked: string | null;
}) {
  const [sending, setSending] = useState(false);

  async function run() {
    setSending(true);
    try {
      const response = await fetch("/api/root/feedback/test-notify", {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось отправить проверку");
      }

      const telegram = data?.telegram
        ? `Telegram: отправлено в ${data.telegramChats} чат(ов)`
        : "Telegram: не отправлено";
      const email = !data?.emailConfigured
        ? "Почта: адрес не настроен"
        : data?.email
          ? "Почта: отправлена"
          : "Почта: ошибка";

      const message = `${telegram} · ${email}`;
      if (data?.telegram || data?.email) {
        toast.success(message);
      } else {
        toast.error(message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось отправить проверку"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={run}
        disabled={sending}
        className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15 disabled:opacity-60"
      >
        <BellRing className="size-4" />
        {sending ? "Отправляем…" : "Проверить уведомления"}
      </button>
      <p className="text-[12px] text-[#6f7282]">
        {chatIdsMasked.length > 0
          ? `Telegram: ${chatIdsMasked.join(", ")}`
          : "Telegram: чат не настроен"}
        {" · "}
        {emailMasked ? `почта: ${emailMasked}` : "почта: не настроена"}
      </p>
    </div>
  );
}
