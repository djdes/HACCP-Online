"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConsultantCard } from "@/components/dashboard/consultant-card";
import {
  AttachButton,
  AttachmentChips,
  MessageAttachments,
  useAttachmentUploads,
} from "@/components/support/attachment-composer";
import { openSanpinChat } from "@/lib/sanpin-chat-bus";
import type { ConsultantContact } from "@/lib/partners/consultant-contact-shared";
import type { SupportAttachmentMeta } from "@/lib/support-attachments-shared";

/**
 * Поддержка одной кнопкой в углу кабинета.
 *
 * Раньше вход в поддержку был в двух местах: кнопка «Обратная связь» в
 * шапке и этот пузырь внизу. Человек не понимал, чем они отличаются, а
 * отличались они только тем, куда падало сообщение. Теперь вход один, а
 * внутри — выбор: разовое обращение или живая переписка.
 *
 * Шапка показывает, под кем человек авторизован: поддержка видит ровно
 * эти данные, и расхождений «я писал не с того аккаунта» не возникает.
 */

type Screen = "menu" | "feedback" | "chat";

type FeedbackType = "bug" | "suggestion" | "partnership";

const FEEDBACK_TYPES: Array<{ value: FeedbackType; label: string }> = [
  { value: "bug", label: "Ошибка" },
  { value: "suggestion", label: "Улучшение" },
  { value: "partnership", label: "Сотрудничество" },
];

type Identity = {
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
};

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  operatorName: string | null;
  attachments?: SupportAttachmentMeta[];
  createdAt: string;
};

/** Пока чат открыт, тянем новые реплики — ответ оператора должен появиться сам. */
const CHAT_POLL_MS = 10_000;

/**
 * `consultant` — партнёр, сопровождающий организацию (white-label).
 * В меню помощи он идёт первым: клиенту партнёра быстрее написать своему
 * консультанту, чем в общую поддержку WeSetup.
 */
export function SupportWidget({
  consultant = null,
}: {
  consultant?: ConsultantContact | null;
} = {}) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");
  const [identity, setIdentity] = useState<Identity | null>(null);

  const [type, setType] = useState<FeedbackType | "">("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Вложения: чат и форма обратной связи — раздельные наборы, чтобы файл
  // из чата не улетел с обращением и наоборот.
  const chatFiles = useAttachmentUploads();
  const feedbackFiles = useAttachmentUploads();

  const loadChat = useCallback(async () => {
    const response = await fetch("/api/support/chat").catch(() => null);
    if (!response?.ok) {
      setMessages([]);
      return;
    }
    const data = await response.json();
    setIdentity(data.identity ?? null);
    setMessages(data.messages ?? []);
  }, []);

  // Данные шапки нужны сразу при открытии, ещё до выбора экрана.
  useEffect(() => {
    if (!open || identity) return;
    void loadChat();
  }, [open, identity, loadChat]);

  useEffect(() => {
    if (!open || screen !== "chat") return;
    const timer = setInterval(() => void loadChat(), CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [open, screen, loadChat]);

  useEffect(() => {
    if (screen === "chat") {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [screen, messages]);

  function close() {
    setOpen(false);
    setScreen("menu");
    setSent(false);
    setType("");
    setMessage("");
  }

  async function sendFeedback() {
    if (!type) {
      toast.error("Выберите тип обращения");
      return;
    }
    if (message.trim().length < 3) {
      toast.error("Напишите, в чём дело");
      return;
    }
    if (feedbackFiles.uploading) {
      toast.error("Дождитесь загрузки файлов");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          attachments: feedbackFiles.readyAttachments,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось отправить обращение");
      }
      setSent(true);
      setMessage("");
      setType("");
      feedbackFiles.clear();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    const body = draft.trim();
    const attachments = chatFiles.readyAttachments;
    // Можно отправить только файл, без текста — «просто скинул скрин».
    if (body.length < 2 && attachments.length === 0) return;
    if (chatFiles.uploading) {
      toast.error("Дождитесь загрузки файлов");
      return;
    }
    setBusy(true);
    // Поле очищаем сразу: ждать сеть, глядя в собственный текст, — худшее,
    // что может делать чат. При ошибке текст вернём обратно.
    setDraft("");
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body, attachments }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.message) {
        throw new Error(data?.error ?? "Не удалось отправить сообщение");
      }
      setMessages((current) => [...(current ?? []), data.message]);
      chatFiles.clear();
    } catch (error) {
      setDraft(body);
      toast.error(error instanceof Error ? error.message : "Ошибка");
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
    <div className="fixed bottom-5 right-5 z-40 flex max-h-[min(640px,calc(100vh-2.5rem))] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-[#ececf4] bg-white shadow-[0_30px_80px_-20px_rgba(11,16,36,0.45)]">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eef0f6] px-5 py-4">
        <div className="min-w-0">
          {screen !== "menu" ? (
            <button
              type="button"
              onClick={() => {
                setScreen("menu");
                setSent(false);
              }}
              className="mb-1 inline-flex items-center gap-1 text-[12.5px] text-[#6f7282] transition-colors hover:text-[#3848c7]"
            >
              <ArrowLeft className="size-3.5" />
              Назад
            </button>
          ) : null}
          <div className="text-[15px] font-semibold text-[#0b1024]">
            {screen === "feedback"
              ? "Обратная связь"
              : screen === "chat"
                ? "Онлайн-чат"
                : "Поддержка"}
          </div>
          {/* Под кем авторизован: поддержка видит ровно эти данные. */}
          <div className="mt-1 space-y-0.5 text-[12px] leading-snug text-[#6f7282]">
            {identity?.organizationName ? (
              <div className="truncate">{identity.organizationName}</div>
            ) : null}
            {identity?.email ? (
              <div className="truncate">{identity.email}</div>
            ) : null}
            {identity?.phone ? (
              <div className="truncate">{identity.phone}</div>
            ) : null}
            {/* Показали контакты — сразу дали, где их поправить: это те же
                поля пользователя, что увидит оператор. */}
            <Link
              href="/settings/phone"
              onClick={close}
              className="inline-flex items-center gap-1 pt-0.5 text-[12px] font-medium text-[#5566f6] transition-colors duration-150 hover:text-[#3848c7]"
            >
              <Pencil className="size-3" />
              Изменить
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-lg p-1 text-[#9b9fb3] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024]"
          aria-label="Закрыть"
        >
          <X className="size-4" />
        </button>
      </div>

      {screen === "menu" ? (
        <div className="space-y-2 p-5">
          {consultant ? <ConsultantCard consultant={consultant} compact /> : null}
          {/* Помощник первым: на «как заполнить» и «где найти» он отвечает
              за секунды, и человеку не нужно ждать оператора. Открываем не
              свой экран, а соседний пузырь — AI-чат в кабинете один. */}
          <button
            type="button"
            onClick={() => {
              openSanpinChat();
              close();
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#5566f6]/30 bg-[#f5f6ff] px-4 py-3 text-left transition-colors hover:border-[#5566f6]/60 hover:bg-[#eef1ff]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#5566f6] text-white">
              <Bot className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#0b1024]">
                ИИ Помощник
              </span>
              <span className="block text-[12px] text-[#6f7282]">
                Поможет по вашим журналам
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScreen("feedback")}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#dcdfed] bg-white px-4 py-3 text-left transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5566f6]">
              <MessagesSquare className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#0b1024]">
                Обратная связь
              </span>
              <span className="block text-[12px] text-[#6f7282]">
                Сотрудничество / Идея / Ошибка
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScreen("chat")}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#dcdfed] bg-white px-4 py-3 text-left transition-colors hover:border-[#0f7a5a]/40 hover:bg-[#ecfdf5]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#ecfdf5] text-[#0f7a5a]">
              <MessageCircle className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#0b1024]">
                Онлайн-чат
              </span>
              <span className="block text-[12px] text-[#6f7282]">
                Связь с оператором
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {screen === "feedback" ? (
        sent ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[14px] leading-[1.55] text-[#0b1024]">
              Спасибо, обязательно ответим в течение 5 рабочих дней.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-4 inline-flex h-10 items-center rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#4a5bf0]"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                Тип обращения
              </div>
              <div className="space-y-1.5">
                {FEEDBACK_TYPES.map((item) => (
                  <label
                    key={item.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[14px] transition-colors",
                      type === item.value
                        ? "border-[#5566f6] bg-[#f5f6ff] text-[#0b1024]"
                        : "border-[#dcdfed] bg-white text-[#3c4053] hover:bg-[#fafbff]"
                    )}
                  >
                    <input
                      type="radio"
                      name="support-feedback-type"
                      value={item.value}
                      checked={type === item.value}
                      onChange={() => setType(item.value)}
                      className="size-4 accent-[#5566f6]"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onPaste={feedbackFiles.handlePaste}
              rows={6}
              placeholder="Опишите подробнее — что произошло или что предлагаете"
              className="w-full resize-none rounded-2xl border border-[#dcdfed] px-3.5 py-3 text-[14px] leading-[1.55] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />

            <div>
              <AttachmentChips
                uploads={feedbackFiles.uploads}
                onRemove={feedbackFiles.remove}
              />
              <div className="flex items-center gap-2">
                <AttachButton
                  onFiles={feedbackFiles.addFiles}
                  disabled={busy}
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13px] font-medium text-[#3c4053] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                />
                <button
                  type="button"
                  onClick={() => void sendFeedback()}
                  disabled={busy || feedbackFiles.uploading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[14px] font-medium text-white transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Отправить
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-[#9b9fb3]">
                Можно приложить скриншот или файл — до 50 МБ, без исполняемых.
              </p>
            </div>
          </div>
        )
      ) : null}

      {screen === "chat" ? (
        <>
          <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
            {messages === null ? (
              <div className="flex items-center gap-2 text-[13px] text-[#9b9fb3]">
                <Loader2 className="size-4 animate-spin" />
                Загружаем переписку
              </div>
            ) : messages.length === 0 ? (
              <p className="py-6 text-center text-[13px] leading-snug text-[#6f7282]">
                Напишите вопрос — ответим здесь же. Переписка сохраняется,
                можно вернуться к ней позже.
              </p>
            ) : (
              messages.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.5]",
                    item.author === "client"
                      ? "ml-auto bg-[#5566f6] text-white"
                      : "bg-[#f5f6ff] text-[#0b1024]"
                  )}
                >
                  {item.author === "operator" && item.operatorName ? (
                    <div className="mb-0.5 text-[11px] font-medium text-[#3848c7]">
                      {item.operatorName}
                    </div>
                  ) : null}
                  {item.body ? (
                    <div className="whitespace-pre-wrap break-words">
                      {item.body}
                    </div>
                  ) : null}
                  <MessageAttachments
                    attachments={item.attachments}
                    light={item.author === "client"}
                  />
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-[#eef0f6] p-3">
            <AttachmentChips
              uploads={chatFiles.uploads}
              onRemove={chatFiles.remove}
            />
            <div className="flex items-end gap-2">
              <AttachButton onFiles={chatFiles.addFiles} disabled={busy} />
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onPaste={chatFiles.handlePaste}
                onKeyDown={(event) => {
                  // Enter отправляет, Shift+Enter — перенос строки: так
                  // ведут себя все мессенджеры, и переучивать незачем.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendChat();
                  }
                }}
                rows={1}
                placeholder="Сообщение"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#dcdfed] px-3.5 py-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
              />
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={
                  busy ||
                  chatFiles.uploading ||
                  (draft.trim().length < 2 &&
                    chatFiles.readyAttachments.length === 0)
                }
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#5566f6] text-white transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
                aria-label="Отправить"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
