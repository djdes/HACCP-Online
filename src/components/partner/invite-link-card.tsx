"use client";

import { useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import type { InviteTexts } from "@/lib/partners/invite-texts";
import { btnOutline, btnPrimary } from "@/components/partner/ui";
import { cn } from "@/lib/utils";

/**
 * Ссылка `/p/<slug>` + 6-значный код + готовые тексты. Один компонент на
 * страницу «Приглашения» и второй шаг онбординга.
 */
export function InviteLinkCard({ texts, compact = false }: { texts: InviteTexts; compact?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(`${label} — скопировано`);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      toast.error("Не удалось скопировать — выделите текст вручную");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">Ваша ссылка</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="min-w-0 break-all text-[15px] font-medium text-[#0b1024]">{texts.url}</code>
            <button
              type="button"
              className={cn(btnOutline, "h-9 px-3")}
              onClick={() => copy("url", texts.url, "Ссылка")}
            >
              {copied === "url" ? <Check className="size-4 text-[#116b2a]" /> : <Copy className="size-4 text-[#5566f6]" />}
              Копировать
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-[1.5] text-[#6f7282]">
            Клиент открывает ссылку, регистрируется — и сразу привязан к вам. Если аккаунт уже есть, он выбирает
            «Войти» и подтверждает подключение.
          </p>
        </div>
        <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 md:w-[220px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">Код партнёра</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[26px] font-semibold tracking-[0.18em] text-[#0b1024]">{texts.code}</span>
            <button
              type="button"
              aria-label="Скопировать код"
              className={cn(btnOutline, "size-9 px-0")}
              onClick={() => copy("code", texts.code, "Код")}
            >
              {copied === "code" ? <Check className="size-4 text-[#116b2a]" /> : <Copy className="size-4 text-[#5566f6]" />}
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-[1.5] text-[#6f7282]">Вводится в Настройки → «Консультант».</p>
        </div>
      </div>

      {!compact ? (
        <div className="grid gap-3 md:grid-cols-2">
          <TextBlock
            title="Короткий текст"
            hint="Для мессенджера или SMS"
            text={texts.short}
            copied={copied === "short"}
            onCopy={() => copy("short", texts.short, "Короткий текст")}
          />
          <TextBlock
            title="Подробный текст"
            hint="Для письма или личного сообщения"
            text={texts.long}
            copied={copied === "long"}
            onCopy={() => copy("long", texts.long, "Подробный текст")}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <a href={texts.telegramShareUrl} target="_blank" rel="noopener noreferrer" className={btnPrimary}>
          <Send className="size-4" />
          Отправить в Telegram
        </a>
        {compact ? (
          <button type="button" className={btnOutline} onClick={() => copy("short", texts.short, "Текст приглашения")}>
            <Copy className="size-4 text-[#5566f6]" />
            Скопировать текст приглашения
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TextBlock({
  title,
  hint,
  text,
  copied,
  onCopy,
}: {
  title: string;
  hint: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#ececf4] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-medium text-[#0b1024]">{title}</div>
          <div className="text-[12px] text-[#6f7282]">{hint}</div>
        </div>
        <button type="button" className={cn(btnOutline, "h-9 px-3")} onClick={onCopy}>
          {copied ? <Check className="size-4 text-[#116b2a]" /> : <Copy className="size-4 text-[#5566f6]" />}
          Копировать
        </button>
      </div>
      <pre className="mt-3 flex-1 whitespace-pre-wrap rounded-xl bg-[#fafbff] p-3 font-sans text-[13px] leading-[1.55] text-[#3c4053]">
        {text}
      </pre>
    </div>
  );
}
