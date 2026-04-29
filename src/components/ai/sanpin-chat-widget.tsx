"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STARTERS = [
  "Какая температура для холодильника готовых блюд?",
  "Как часто менять масло во фритюре?",
  "Что должно быть в журнале гигиены сотрудников?",
  "Какие документы нужны при приёмке мясного сырья?",
];

const STORAGE_KEY = "wesetup-sanpin-chat-v1";

/**
 * Floating-чат «AI помощник по СанПиН/ХАССП». Маленькая иконка в нижнем
 * правом углу dashboard'а; клик — открывает sheet с историей. Сообщения
 * сохраняются в localStorage, чтобы менеджер мог вернуться к диалогу
 * после рефреша страницы.
 *
 * История бережно ограничена 20 сообщениями (= 10 пар) — больше Claude
 * Haiku на context-window держит, но это лишний расход токенов и
 * замусоривание system-prompt'а.
 */
export function SanpinChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore chat history on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed.slice(-20));
      }
    } catch {
      /* ignore corrupted storage */
    }
  }, []);

  // Save on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* quota exceeded — silently skip */
    }
  }, [messages]);

  // Scroll to bottom on new message.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Focus input on open.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Quota state — обновляется после каждого ответа сервера.
  // null = не знаем (ещё не было запроса), -1 = unlimited.
  const [messagesLeft, setMessagesLeft] = useState<number | null>(null);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || busy) return;
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/ai/sanpin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-20) }),
      });
      const data = await response.json();
      if (!response.ok) {
        // Quota exceeded — отдельный UX, не просто toast.
        if (data?.quotaExceeded) {
          setMessages(messages);
          setMessagesLeft(0);
          toast.error(
            `Месячный лимит ${data.quota ?? 20} сообщений исчерпан. Свяжитесь с поддержкой для апгрейда тарифа.`,
            { duration: 8000 }
          );
          return;
        }
        throw new Error(data?.error ?? "Ошибка AI");
      }
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: data.reply || "(пустой ответ)" },
      ]);
      if (typeof data.messagesLeft === "number") {
        setMessagesLeft(data.messagesLeft);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка AI");
      // Roll back the optimistic user message — keeps history clean.
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (!confirm("Очистить переписку?")) return;
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {/* FAB launcher — компактная иконка-кнопка */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-[#5566f6] to-[#7a5cff] text-white shadow-[0_12px_28px_-10px_rgba(85,102,246,0.6)] transition-all hover:scale-105"
          aria-label="AI помощник по СанПиН"
          title="AI помощник"
        >
          <Sparkles className="size-4" />
        </button>
      ) : null}

      {/* Sheet */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 sm:items-end sm:p-5">
          <div className="flex h-[80svh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_-20px_rgba(11,16,36,0.4)] sm:h-[600px] sm:max-h-[80svh] sm:w-[440px] sm:rounded-3xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#ececf4] bg-gradient-to-br from-[#5566f6] to-[#7a5cff] px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-white/15">
                  <Bot className="size-5" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold">AI помощник</div>
                  <div className="text-[12px] text-white/80">
                    СанПиН, ХАССП и ТР ТС
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                >
                  Очистить
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-white hover:bg-white/15"
                  aria-label="Закрыть"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4 text-[14px]"
            >
              {messages.length === 0 ? (
                <div className="space-y-3 text-[13px] leading-relaxed text-[#3c4053]">
                  <p>
                    Я помогу с вопросами о санитарных нормах и ХАССП. Спросите,
                    например:
                  </p>
                  <div className="grid gap-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-3 py-2 text-left text-[13px] text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="rounded-xl bg-[#fff8eb] px-3 py-2 text-[12px] text-[#7a4a00]">
                    Ответы AI — рекомендация. Окончательное решение принимает
                    ваш технолог.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <MessageBubble key={i} role={m.role} content={m.content} />
                  ))}
                  {busy ? (
                    <div className="flex items-center gap-2 text-[12px] text-[#6f7282]">
                      <Loader2 className="size-3 animate-spin" />
                      Думаю…
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-[#ececf4] bg-white px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ваш вопрос…"
                  className="h-11 flex-1 rounded-xl border border-[#dcdfed] bg-[#fafbff] px-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                  disabled={busy || messagesLeft === 0}
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim() || messagesLeft === 0}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#5566f6] text-white transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
                  aria-label="Отправить"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
              </div>
              {messagesLeft !== null && messagesLeft >= 0 ? (
                <div className="mt-2 text-center text-[11px] text-[#9b9fb3]">
                  {messagesLeft === 0
                    ? "Месячный лимит исчерпан. Перейдите на Pro для безлимитного доступа."
                    : `Осталось сообщений в этом месяце: ${messagesLeft}`}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.55] ${
          isUser
            ? "bg-[#5566f6] text-white"
            : "border border-[#ececf4] bg-[#fafbff] text-[#0b1024]"
        }`}
      >
        {content.split("\n").map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>
            {line || " "}
          </p>
        ))}
      </div>
    </div>
  );
}
