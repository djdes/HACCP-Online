"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  ClipboardList,
  Copy,
  ExternalLink,
  Send,
  Thermometer,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

interface NotificationSettingsProps {
  botUsername: string;
  linkToken: string;
}

interface NotificationPrefs {
  temperature: boolean;
  deviations: boolean;
  compliance: boolean;
}

const PREF_ITEMS: Array<{
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "temperature",
    label: "Отклонения температуры",
    description: "Срабатывает когда IoT-датчик выходит за норму оборудования",
    icon: Thermometer,
  },
  {
    key: "deviations",
    label: "Отклонения в журналах",
    description: "Бракераж, гигиена, ККТ, невалидные записи",
    icon: AlertTriangle,
  },
  {
    key: "compliance",
    label: "Незаполненные журналы",
    description: "Ежедневный дайджест того, что надо заполнить",
    icon: ClipboardList,
  },
];

export function NotificationSettings({
  botUsername,
  linkToken,
}: NotificationSettingsProps) {
  const router = useRouter();
  const [isLinked, setIsLinked] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    temperature: true,
    deviations: true,
    compliance: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const botLink = botUsername
    ? `https://t.me/${botUsername}?start=${linkToken}`
    : "";
  const startCommand = linkToken ? `/start ${linkToken}` : "";

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => res.json())
      .then((data) => {
        setIsLinked(data.isLinked);
        setPrefs(data.prefs);
      })
      .catch(() => toast.error("Ошибка загрузки настроек"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleUnlink() {
    setIsUnlinking(true);
    try {
      const res = await fetch("/api/notifications/telegram/unlink", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setIsLinked(false);
      toast.success("Telegram отвязан");
      router.refresh();
    } catch {
      toast.error("Ошибка при отвязке Telegram");
    } finally {
      setIsUnlinking(false);
    }
  }

  async function handlePrefChange(
    key: keyof NotificationPrefs,
    value: boolean
  ) {
    const oldPrefs = prefs;
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      if (!res.ok) throw new Error();
      toast.success("Сохранено");
    } catch {
      setPrefs(oldPrefs);
      toast.error("Ошибка сохранения");
    }
  }

  async function copyStartCommand() {
    if (!startCommand) return;
    try {
      await navigator.clipboard.writeText(startCommand);
      toast.success("Команда скопирована — вставьте её в @" + botUsername);
    } catch {
      toast.error("Скопируйте вручную");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <HeaderBlock />
        <div className="rounded-3xl border border-[#eceef7] bg-white p-8">
          <div className="h-5 w-64 animate-pulse rounded-full bg-[#eceef7]" />
          <div className="mt-4 h-3 w-96 animate-pulse rounded-full bg-[#f4f5fb]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <HeaderBlock />

      {/* Hero: Telegram connection status */}
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at 30% 40%, black 40%, transparent 70%)",
          }}
        />
        <div className="relative z-10 grid gap-6 p-5 sm:gap-8 sm:p-8 md:grid-cols-[1.4fr_1fr] md:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] uppercase tracking-[0.18em] text-white/70 backdrop-blur">
              <span
                className={`size-1.5 rounded-full ${
                  isLinked ? "bg-[#7cf5c0]" : "bg-[#ffb08a]"
                }`}
              />
              {isLinked ? "Канал активен" : "Не подключено"}
            </div>
            <h2 className="mt-4 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
              Telegram-бот уведомлений
            </h2>
            <p className="mt-3 max-w-[440px] text-[14px] leading-[1.6] text-white/70">
              Получайте оповещения о температурных отклонениях,
              незаполненных журналах и новых назначениях — прямо в Telegram.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {isLinked ? (
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-[15px] font-medium text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-60"
                >
                  <Unlink className="size-4" />
                  {isUnlinking ? "Отвязка…" : "Отвязать Telegram"}
                </button>
              ) : botLink ? (
                <>
                  <a
                    href={botLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-2xl bg-[#5566f6] px-5 text-[15px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0]"
                  >
                    <span className="relative z-10 inline-flex items-center gap-2">
                      <Send className="size-4" />
                      Открыть @{botUsername}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span
                      aria-hidden
                      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={copyStartCommand}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 text-[15px] font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/10"
                    title="Скопировать команду /start <токен>"
                  >
                    <ClipboardCopy className="size-4" />
                    Скопировать команду
                  </button>
                </>
              ) : (
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-[13px] text-white/70">
                  Telegram-бот пока не настроен администратором.
                </div>
              )}
            </div>
          </div>

          {/* Right: chat bubble preview */}
          <div className="hidden self-stretch md:block">
            <ChatPreview linked={isLinked} botUsername={botUsername} />
          </div>
        </div>
      </section>

      {/* How-to */}
      {!isLinked && botLink && (
        <section className="rounded-3xl border border-[#ececf4] bg-white p-8 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 className="text-[20px] font-semibold tracking-tight text-[#0b1024]">
                Как привязать
              </h3>
              <p className="mt-2 max-w-[520px] text-[14px] text-[#6f7282]">
                Если при нажатии «Start» в боте ничего не приходит — Telegram
                не передал параметр. Отправьте боту команду вручную.
              </p>
            </div>
          </div>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            <HowStep
              index={1}
              title="Откройте бота"
              body={
                <>
                  Нажмите кнопку{" "}
                  <span className="font-medium text-[#0b1024]">
                    «Открыть @{botUsername}»
                  </span>{" "}
                  выше. Откроется чат с ботом.
                </>
              }
            />
            <HowStep
              index={2}
              title="Отправьте команду"
              body={
                <>
                  В чате с ботом отправьте{" "}
                  <button
                    type="button"
                    onClick={copyStartCommand}
                    className="group inline-flex items-center gap-1 rounded-lg border border-[#d6d9ee] bg-[#f5f6ff] px-2 py-0.5 font-mono text-[13px] text-[#5566f6] hover:bg-[#eef1ff]"
                  >
                    <Copy className="size-3" />
                    /start&nbsp;...
                  </button>{" "}
                  (кнопка «Скопировать команду» положит её в буфер).
                </>
              }
            />
            <HowStep
              index={3}
              title="Готово"
              body={
                <>
                  Бот ответит{" "}
                  <span className="font-medium text-[#0b1024]">
                    «Аккаунт успешно привязан»
                  </span>
                  . Токен действителен 15 минут — если истёк, обновите
                  страницу.
                </>
              }
            />
          </ol>
        </section>
      )}

      {/* Preferences */}
      <section className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <header className="flex items-start justify-between gap-6 border-b border-[#f0f1f8] px-8 py-6">
          <div>
            <h3 className="text-[20px] font-semibold tracking-tight text-[#0b1024]">
              Типы уведомлений
            </h3>
            <p className="mt-1 text-[14px] text-[#6f7282]">
              {isLinked
                ? "Управляйте тем, какие события доходят до вашего чата."
                : "Станут активны после привязки Telegram."}
            </p>
          </div>
        </header>
        <ul className="divide-y divide-[#f0f1f8]">
          {PREF_ITEMS.map((item) => {
            const Icon = item.icon;
            const value = prefs[item.key];
            return (
              <li
                key={item.key}
                className={`flex items-center justify-between gap-6 px-8 py-5 ${
                  !isLinked ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f6ff] text-[#5566f6]">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="text-[15px] font-medium text-[#0b1024]">
                      {item.label}
                    </div>
                    <div className="mt-1 text-[13px] text-[#6f7282]">
                      {item.description}
                    </div>
                  </div>
                </div>
                <SwitchToggle
                  checked={value}
                  disabled={!isLinked}
                  onChange={(v) => handlePrefChange(item.key, v)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Footer note */}
      <section className="rounded-3xl border border-[#f0f1f8] bg-[#fafbff] p-6 text-[13px] text-[#6f7282]">
        <div className="font-medium text-[#0b1024]">Полезно знать</div>
        <ul className="mt-3 grid gap-1.5 md:grid-cols-2">
          <li>• Уведомления получают все владельцы организации.</li>
          <li>• Команда <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-[#5566f6]">/stop</code> в боте отвяжет ваш аккаунт.</li>
          <li>• История отправок: <a href="/root/telegram-logs" className="text-[#5566f6] hover:underline">/root/telegram-logs</a> (только для ROOT).</li>
          <li>• Бот не пишет первым — инициатива всегда с вашей стороны.</li>
        </ul>
      </section>
    </div>
  );
}

function HeaderBlock() {
  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        Уведомления
      </h1>
      <p className="mt-1 text-[14px] text-[#6f7282]">
        Telegram-канал уведомлений и предпочтения по типам событий.
      </p>
    </div>
  );
}

function HowStep({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-[#f0f1f8] bg-[#fafbff] p-5">
      <div className="flex size-7 items-center justify-center rounded-full bg-[#0b1024] text-[12px] font-semibold text-white">
        {index}
      </div>
      <div className="mt-3 text-[15px] font-medium text-[#0b1024]">{title}</div>
      <div className="mt-1.5 text-[13px] leading-[1.6] text-[#6f7282]">
        {body}
      </div>
    </li>
  );
}

function SwitchToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5566f6]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed ${
        checked ? "bg-[#5566f6]" : "bg-[#e4e5f0]"
      }`}
    >
      <span
        className={`inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ChatPreview({
  linked,
  botUsername,
}: {
  linked: boolean;
  botUsername: string;
}) {
  return (
    <div className="relative h-full w-full rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-[#5566f6] text-[12px] font-semibold uppercase">
          {botUsername.slice(0, 2) || "tg"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-white">
            @{botUsername}
          </div>
          <div className="text-[11px] text-white/50">
            {linked ? "в сети" : "ожидает привязки"}
          </div>
        </div>
        <ExternalLink className="ml-auto size-4 text-white/40" />
      </div>
      <div className="mt-3 space-y-2">
        {linked ? (
          <>
            <Bubble
              variant="bot"
              body="🔔 Вам назначен журнал: Температурный режим"
              time="10:02"
            />
            <Bubble
              variant="bot"
              body="⚠️ Температура в холодильнике 1 вышла за норму: 9.8°C"
              time="12:17"
            />
            <Bubble
              variant="bot"
              body="📋 Сегодня не заполнены: 2 журнала"
              time="18:00"
            />
          </>
        ) : (
          <>
            <Bubble variant="me" body="/start" time="..." />
            <Bubble
              variant="bot"
              body="Для привязки откройте ссылку из настроек HACCP-Online"
              time="..."
              muted
            />
          </>
        )}
      </div>
    </div>
  );
}

function Bubble({
  variant,
  body,
  time,
  muted,
}: {
  variant: "bot" | "me";
  body: string;
  time: string;
  muted?: boolean;
}) {
  const isMe = variant === "me";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-[1.4] ${
          isMe
            ? "bg-[#5566f6] text-white"
            : muted
              ? "bg-white/10 text-white/60"
              : "bg-white/15 text-white/90"
        }`}
      >
        <div className="whitespace-pre-line">{body}</div>
        <div className="mt-0.5 text-right text-[10px] text-white/40">{time}</div>
      </div>
    </div>
  );
}
