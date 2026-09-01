"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Поддержка для гостя сайта — тот же пузырь, что в кабинете, только без
 * авторизации.
 *
 * Отличие ровно одно и оно определяет всю форму: у гостя нет профиля,
 * поэтому вместо шапки «под кем вы авторизованы» он сам оставляет телефон
 * и почту. Требуем хотя бы одно из двух — без контакта ответить некуда, а
 * заставлять заполнять оба поля значит терять половину обращений.
 *
 * Переписка привязана к случайному id в localStorage: вернувшись через
 * день, человек видит свою ветку, а не пустой чат.
 */

type Screen = "menu" | "feedback" | "chat";
type FeedbackType = "bug" | "suggestion" | "partnership";

const FEEDBACK_TYPES: Array<{ value: FeedbackType; label: string }> = [
  { value: "bug", label: "Ошибка" },
  { value: "suggestion", label: "Улучшение" },
  { value: "partnership", label: "Сотрудничество" },
];

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  operatorName: string | null;
  createdAt: string;
};

const GUEST_KEY = "wesetup.support-guest-id";
const CONTACT_KEY = "wesetup.support-contact";
const CHAT_POLL_MS = 10_000;

/** id гостя переживает перезагрузку — иначе ветка теряется на F5. */
function readGuestId(): string {
  try {
    const stored = localStorage.getItem(GUEST_KEY);
    if (stored) return stored;
    const fresh = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, fresh);
    return fresh;
  } catch {
    // Приватный режим — id живёт только в памяти вкладки.
    return crypto.randomUUID();
  }
}

export function PublicSupportWidget() {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  /// Ловушка для ботов: поле спрятано от человека, но не от автозаполнялки.
  const [company, setCompany] = useState("");

  const [type, setType] = useState<FeedbackType | "">("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const guestId = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || guestId.current) return;
    guestId.current = readGuestId();
    try {
      const saved = localStorage.getItem(CONTACT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { email?: string; phone?: string };
        setEmail((value) => value || parsed.email || "");
        setPhone((value) => value || parsed.phone || "");
      }
    } catch {
      /* контакты не восстановились — спросим заново */
    }
  }, [open]);

  const rememberContact = useCallback(() => {
    try {
      localStorage.setItem(CONTACT_KEY, JSON.stringify({ email, phone }));
    } catch {
      /* приватный режим — просто не запоминаем */
    }
  }, [email, phone]);

  const loadChat = useCallback(async () => {
    if (!guestId.current) return;
    const response = await fetch(
      "/api/public/support-chat?guestId=" +
        encodeURIComponent(guestId.current)
    ).catch(() => null);
    if (!response?.ok) {
      setMessages((current) => current ?? []);
      return;
    }
    const data = await response.json().catch(() => null);
    setMessages(data?.messages ?? []);
    if (data?.contact?.email) setEmail((value) => value || data.contact.email);
    if (data?.contact?.phone) setPhone((value) => value || data.contact.phone);
  }, []);

  useEffect(() => {
    if (!open || screen !== "chat") return;
    void loadChat();
    const timer = setInterval(() => void loadChat(), CHAT_POLL_MS);
    return () => clearInterval(timer);
  }, [open, screen, loadChat]);

  useEffect(() => {
    if (screen === "chat") bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, screen]);

  function close() {
    setOpen(false);
    setScreen("menu");
    setSent(false);
  }

  const hasContact = email.trim().length > 0 || phone.trim().length > 0;

  async function sendFeedback() {
    if (!type) {
      toast.error("Выберите тип обращения");
      return;
    }
    if (message.trim().length < 3) {
      toast.error("Напишите, что случилось");
      return;
    }
    if (!hasContact) {
      toast.error("Оставьте телефон или почту — иначе некуда ответить");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, email, phone, company }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось отправить");
      rememberContact();
      setSent(true);
      setMessage("");
      setType("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat() {
    const body = draft.trim();
    if (body.length < 2) return;
    if (!hasContact) {
      toast.error("Оставьте телефон или почту — иначе некуда ответить");
      return;
    }
    setBusy(true);
    setDraft("");
    try {
      const response = await fetch("/api/public/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: guestId.current,
          message: body,
          email,
          phone,
          company,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.message) {
        throw new Error(data?.error ?? "Не удалось отправить сообщение");
      }
      rememberContact();
      setMessages((current) => [...(current ?? []), data.message]);
    } catch (error) {
      setDraft(body);
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  /** Телефон и почта — одинаковая пара на обоих экранах. */
  const contactFields = (
    <div className="relative grid gap-2 sm:grid-cols-2">
      <input
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Телефон"
        autoComplete="tel"
        inputMode="tel"
        className="h-11 w-full rounded-xl border border-[#dcdfed] bg-white px-3.5 text-[16px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
      />
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="E-mail"
        autoComplete="email"
        inputMode="email"
        className="h-11 w-full rounded-xl border border-[#dcdfed] bg-white px-3.5 text-[16px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
      />
      {/* Ловушка: скрыта от человека, видна автозаполнялке бота. */}
      <input
        type="text"
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] size-0 opacity-0"
      />
    </div>
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex h-12 items-center gap-2 rounded-full bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_16px_40px_-16px_rgba(85,102,246,0.75)] transition-all hover:-translate-y-0.5 hover:bg-[#4a5bf0]"
        aria-label="Связаться с нами"
      >
        <MessageCircle className="size-4" />
        Связаться
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
                : "Связаться с нами"}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-[#6f7282]">
            Отвечаем в рабочие часы, обычно в течение дня
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
                Вопрос, идея или предложение о сотрудничестве
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
              Спасибо, получили. Ответим на оставленные контакты.
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
                      name="public-feedback-type"
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

            <div className="space-y-2">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                Куда ответить
              </div>
              {contactFields}
              <p className="text-[12px] text-[#9b9fb3]">
                Достаточно одного поля.
              </p>
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder="Опишите подробнее — что нужно или что предлагаете"
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

      {screen === "chat" ? (
        <>
          {!hasContact ? (
            <div className="shrink-0 space-y-2 border-b border-[#eef0f6] px-5 py-4">
              <div className="text-[12.5px] leading-snug text-[#6f7282]">
                Оставьте контакт — если разговор прервётся, ответим по нему.
              </div>
              {contactFields}
            </div>
          ) : null}

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
                  // ведут себя все мессенджеры, переучивать незачем.
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendChat();
                  }
                }}
                rows={1}
                placeholder="Сообщение"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#dcdfed] px-3.5 py-3 text-[16px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
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
