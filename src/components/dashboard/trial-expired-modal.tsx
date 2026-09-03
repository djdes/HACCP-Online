"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Hourglass, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { TRIAL_DAYS, TRIAL_LIMITS } from "@/lib/trial";
import { TEST_PERIOD_UNTIL } from "@/lib/plan-catalog";
import { cn } from "@/lib/utils";

type Props = {
  /** Дата окончания теста (ISO) — для подписи «закончился 17 сентября». */
  endedAt: string | null;
  billingTestMode: boolean;
};

const SESSION_DISMISS_KEY = "wesetup.trial-expired.dismissed";

/**
 * Модалка после 14 дней теста: «продлить» (оформить подписку) или
 * «сократить функционал» (остаться на бесплатном). Показывается
 * management на дашборде, пока организация на `trial` с истёкшей
 * датой. «Напомнить позже» прячет до конца сессии; выбор бесплатного
 * переводит на `free`, и модалка больше не возвращается.
 *
 * Ничего не блокирует: журналы под модалкой работают, как и раньше.
 */
export function TrialExpiredModal({ endedAt, billingTestMode }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SESSION_DISMISS_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function reduce() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/subscription/trial-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "reduce" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Не удалось сохранить выбор");
      }
      toast.success("Вы на бесплатном тарифе", {
        description: `До ${TRIAL_LIMITS.entriesPerDay} записей в день, ${TRIAL_LIMITS.tuyaSensors} датчика, ${TRIAL_LIMITS.aiMessagesPerMonth} AI-сообщений в месяц. Подписку можно оформить в любой момент.`,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const endedLabel = endedAt
    ? new Date(endedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_30px_80px_-20px_rgba(11,16,36,0.45)]">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Hourglass className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              {TRIAL_DAYS} дней тестового периода прошли
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#3c4053]">
              {endedLabel ? `Тест закончился ${endedLabel}. ` : ""}
              Выберите, как продолжить. Журналы, записи и настройки
              сохраняются при любом выборе — ничего не блокируется.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1.5 text-[#9b9fb3] transition-colors hover:bg-[#fafbff] hover:text-[#0b1024]"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Option
            accent
            title="Продлить"
            subtitle="Оформить подписку"
            points={[
              "Без дневного лимита записей",
              "Датчики и автозаполнение без ограничений",
              "До 30 сотрудников в одной подписке",
              billingTestMode
                ? `До ${TEST_PERIOD_UNTIL} — бесплатно, сайт в тестовом режиме`
                : "1 990 ₽ в месяц за всю команду",
            ]}
            action={
              <Link
                href="/settings/subscription"
                onClick={dismiss}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
              >
                Оформить подписку
                <ArrowRight className="size-4" />
              </Link>
            }
          />
          <Option
            title="Сократить функционал"
            subtitle="Остаться на бесплатном"
            points={[
              "Все журналы: просмотр, печать, PDF",
              `До ${TRIAL_LIMITS.entriesPerDay} ручных записей в день`,
              `До ${TRIAL_LIMITS.tuyaSensors} IoT-датчиков`,
              `${TRIAL_LIMITS.aiMessagesPerMonth} AI-сообщений в месяц`,
            ]}
            action={
              <button
                type="button"
                onClick={reduce}
                disabled={busy}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin text-[#5566f6]" />
                ) : null}
                Остаться на бесплатном
              </button>
            }
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="text-[13px] font-medium text-[#6f7282] transition-colors hover:text-[#0b1024]"
          >
            Напомнить позже
          </button>
        </div>
      </div>
    </div>
  );
}

function Option({
  title,
  subtitle,
  points,
  action,
  accent = false,
}: {
  title: string;
  subtitle: string;
  points: string[];
  action: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-4",
        accent
          ? "border-[#5566f6]/30 bg-gradient-to-br from-[#f5f6ff] to-white"
          : "border-[#ececf4] bg-[#fafbff]"
      )}
    >
      <div className="text-[15px] font-semibold tracking-[-0.01em] text-[#0b1024]">
        {title}
      </div>
      <div className="text-[12.5px] text-[#6f7282]">{subtitle}</div>
      <ul className="mt-3 flex-1 space-y-1.5">
        {points.map((point) => (
          <li
            key={point}
            className="flex items-start gap-2 text-[13px] leading-snug text-[#3c4053]"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-[#5566f6]" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">{action}</div>
    </div>
  );
}
