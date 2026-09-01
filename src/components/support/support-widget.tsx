"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

type Screen = "menu" | "feedback" | "chat" | "assistant";

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

type AssistantMessage = {
  id: string;
  role: string;
  content: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  operatorName: string | null;
  createdAt: string;
};

/** Пока чат открыт, тянем новые реплики — ответ оператора должен появиться сам. */
const CHAT_POLL_MS = 10_000;
/**
 * Ассистент отвечает за секунды, а не за часы, — опрашиваем чаще. Пока
 * ответа нет, ход висит в статусе pending, и это единственный признак,
 * по которому виджет понимает, что пора спросить ещё раз.
 */
const ASSISTANT_POLL_MS = 3_000;

export function SupportWidget() {
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

  const [aiMessages, setAiMessages] = useState<AssistantMessage[] | null>(null);
  const [aiDraft, setAiDraft] = useState("");
  const [aiAvailable, setAiAvailable] = useState(true);
  const aiBottomRef = useRef<HTMLDivElement | null>(null);

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

  const loadAssistant = useCallback(async () => {
    const response = await fetch("/api/assistant/messages").catch(() => null);
    if (!response?.ok) {
      setAiMessages((current) => current ?? []);
      return;
    }
    const data = await response.json().catch(() => null);
    setAiMessages(data?.messages ?? []);
    setAiAvailable(data?.available !== false);
  }, []);

  useEffect(() => {
    if (!open || screen !== "assistant") return;
    void loadAssistant();
  }, [open, screen, loadAssistant]);

  /**
   * Опрашиваем, только пока есть незакрытый ход. Ассистент отвечает
   * асинхронно, и других способов узнать про ответ у виджета нет; но
   * когда отвечать нечего, дёргать сервер каждые три секунды незачем.
   */
  useEffect(() => {
    if (!open || screen !== "assistant") return;
    const waiting = (aiMessages ?? []).some((item) => item.status === "pending");
    if (!waiting) return;
    const timer = setInterval(() => void loadAssistant(), ASSISTANT_POLL_MS);
    return () => clearInterval(timer);
  }, [open, screen, aiMessages, loadAssistant]);

  useEffect(() => {
    if (screen === "assistant") {
      aiBottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [aiMessages, screen]);

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
    setBusy(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Не удалось отправить обращение");
      }
      setSent(true);
      setMessage("");
      setType("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendAssistant() {
    const body = aiDraft.trim();
    if (body.length < 2) return;
    setBusy(true);
    setAiDraft("");
    try {
      const response = await fetch("/api/assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось отправить");
      // Сервер возвращает переписку целиком вместе с заготовкой ответа —
      // «печатает» появляется сразу, без лишнего запроса.
      setAiMessages(data?.messages ?? []);
    } catch (error) {
      setAiDraft(body);
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    const body = draft.trim();
    if (body.length < 2) return;
    setBusy(true);
    // Поле очищаем сразу: ждать сеть, глядя в собственный текст, — худшее,
    // что может делать чат. При ошибке текст вернём обратно.
    setDraft("");
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.message) {
        throw new Error(data?.error ?? "Не удалось отправить сообщение");
      }
      setMessages((current) => [...(current ?? []), data.message]);
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
                : screen === "assistant"
                  ? "Ассистент"
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
          {/* Ассистент первым: на «как заполнить» и «где найти» он
              отвечает за секунды, и человеку не нужно ждать оператора. */}
          <button
            type="button"
            onClick={() => setScreen("assistant")}
            className="flex w-full items-center gap-3 rounded-2xl border border-[#5566f6]/30 bg-[#f5f6ff] px-4 py-3 text-left transition-colors hover:border-[#5566f6]/60 hover:bg-[#eef1ff]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#5566f6] text-white">
              <Bot className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-[#0b1024]">
                Ассистент
              </span>
              <span className="block text-[12px] text-[#6f7282]">
                Ответит сразу по вашим журналам и настройкам
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
                Ошибка, идея или предложение о сотрудничестве
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
                Переписка с оператором, история сохраняется
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
              rows={6}
              placeholder="Опишите подробнее — что произошло или что предлагаете"
              className="w-full resize-none rounded-2xl border border-[#dcdfed] px-3.5 py-3 text-[14px] leading-[1.55] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />

            <button
              type="button"
              onClick={() => void sendFeedback()}
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[14px] font-medium text-white transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Отправить
            </button>
          </div>
        )
      ) : null}

      {screen === "assistant" ? (
        <>
          {!aiAvailable ? (
            <div className="shrink-0 border-b border-[#eef0f6] bg-[#fff4f2] px-5 py-3 text-[12.5px] leading-snug text-[#a13a32]">
              Ассистент сейчас выключен. Напишите в обратную связь или в
              онлайн-чат — ответит человек.
            </div>
          ) : null}

          <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
            {aiMessages === null ? (
              <div className="flex items-center gap-2 text-[13px] text-[#9b9fb3]">
                <Loader2 className="size-4 animate-spin" />
                Загружаем переписку
              </div>
            ) : aiMessages.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-[13px] leading-snug text-[#6f7282]">
                  Спросите про журналы, доступы сотрудников, печать бланков
                  или что показывать проверяющему.
                </p>
                <p className="mt-2 text-[12px] leading-snug text-[#9b9fb3]">
                  Ассистент видит только вашу организацию и ничего в ней не
                  меняет — он отвечает, а не выполняет.
                </p>
              </div>
            ) : (
              aiMessages.map((item) => {
                if (item.role === "user") {
                  return (
                    <div
                      key={item.id}
                      className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-[#5566f6] px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-white"
                    >
                      {item.content}
                    </div>
                  );
                }
                if (item.status === "pending") {
                  return (
                    <div
                      key={item.id}
                      className="flex max-w-[85%] items-center gap-2 rounded-2xl bg-[#f5f6ff] px-3.5 py-2.5 text-[13px] text-[#6f7282]"
                    >
                      <Loader2 className="size-3.5 animate-spin" />
                      Думает…
                    </div>
                  );
                }
                if (item.status === "error") {
                  return (
                    <div
                      key={item.id}
                      className="max-w-[85%] rounded-2xl bg-[#fff4f2] px-3.5 py-2.5 text-[13px] leading-[1.5] text-[#a13a32]"
                    >
                      {item.error || "Ассистент не ответил"}
                    </div>
                  );
                }
                return (
                  <div
                    key={item.id}
                    className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-[#f5f6ff] px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-[#0b1024]"
                  >
                    {item.content}
                  </div>
                );
              })
            )}
            <div ref={aiBottomRef} />
          </div>

          <div className="shrink-0 border-t border-[#eef0f6] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={aiDraft}
                onChange={(event) => setAiDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendAssistant();
                  }
                }}
                rows={1}
                placeholder="Спросите про журналы"
                disabled={!aiAvailable}
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#dcdfed] px-3.5 py-3 text-[16px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => void sendAssistant()}
                disabled={busy || !aiAvailable || aiDraft.trim().length < 2}
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#5566f6] text-white transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
                aria-label="Спросить"
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
                  <div className="whitespace-pre-wrap break-words">
                    {item.body}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 border-t border-[#eef0f6] p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
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
                disabled={busy || draft.trim().length < 2}
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
