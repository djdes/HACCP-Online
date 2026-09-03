import Link from "next/link";
import { ArrowRight, Hourglass } from "lucide-react";
import { TEST_PERIOD_UNTIL } from "@/lib/plan-catalog";
import type { TrialUsage } from "@/lib/trial-limits.server";
import { formatDaysRu, formatTrialEndDate } from "@/lib/trial";
import { cn } from "@/lib/utils";

type Props = {
  usage: TrialUsage;
};

/**
 * Карточка тестового периода на /dashboard — для management на
 * бесплатном тарифе (trial / после теста / free). Показывает, сколько
 * дней осталось, три счётчика мягких лимитов и одну кнопку «на
 * подписку». На платном тарифе не рендерится (usage === null).
 */
export function TrialStatusCard({ usage }: Props) {
  const { status, billingTestMode } = usage;

  const heading =
    status.phase === "trial"
      ? {
          eyebrow: "Тестовый период",
          title:
            status.daysLeft <= 1
              ? "Последний день тестового периода"
              : `Осталось ${formatDaysRu(status.daysLeft)}`,
          description: `До ${formatTrialEndDate(status.endsAt)} — все журналы с мягкими лимитами ниже. Потом выберете: подписка без лимитов или бесплатный тариф. Данные сохраняются в любом случае.`,
          cta: "Перейти на подписку",
        }
      : status.phase === "expired"
        ? {
            eyebrow: "Тестовый период",
            title: "Тестовый период закончился",
            description:
              "Журналы работают: просмотр, печать и записи в пределах лимитов бесплатного тарифа. Подписка снимает лимиты.",
            cta: "Продлить — оформить подписку",
          }
        : {
            eyebrow: "Бесплатный тариф",
            title: "Лимиты бесплатного тарифа",
            description:
              "Все журналы доступны. Подписка снимает дневной лимит записей и лимит датчиков.",
            cta: "Улучшить тариф",
          };

  const aiUnlimited = usage.aiQuota < 0;

  return (
    <section
      data-section="trial-status"
      className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Hourglass className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              {heading.eyebrow}
            </div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              {heading.title}
            </h2>
            <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-[#3c4053]">
              {heading.description}
            </p>
          </div>
        </div>
        <Link
          href="/settings/subscription"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
        >
          {heading.cta}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Meter
          label="Записей сегодня"
          used={usage.entriesToday}
          limit={usage.entriesLimit}
          fullHint={
            billingTestMode
              ? "сверх лимита — в тестовом режиме не ограничиваем"
              : "лимит на сегодня исчерпан — до завтра только просмотр"
          }
          hint="ручные записи в журналы, автозаполнение не считается"
        />
        <Meter
          label="IoT-датчиков"
          used={usage.sensors}
          limit={usage.sensorsLimit}
          fullHint={
            billingTestMode
              ? "лимит достигнут — в тестовом режиме не ограничиваем"
              : "новый датчик не привяжется — отвяжите один или оформите подписку"
          }
          hint="привязанных к оборудованию"
        />
        <Meter
          label="AI-сообщений в месяце"
          used={aiUnlimited ? 0 : Math.max(0, usage.aiQuota - usage.aiLeft)}
          limit={aiUnlimited ? 0 : usage.aiQuota}
          unlimited={aiUnlimited}
          fullHint="квота на месяц исчерпана — обновится 1-го числа"
          hint="помощник по СанПиН и подсказки в CAPA"
        />
      </div>

      {billingTestMode ? (
        <p className="mt-4 text-[12.5px] leading-relaxed text-[#6f7282]">
          Сайт в тестовом режиме до {TEST_PERIOD_UNTIL}: лимиты показываем, но
          не ограничиваем — оплата пока не требуется.
        </p>
      ) : null}
    </section>
  );
}

function Meter({
  label,
  used,
  limit,
  unlimited = false,
  hint,
  fullHint,
}: {
  label: string;
  used: number;
  limit: number;
  unlimited?: boolean;
  hint: string;
  fullHint: string;
}) {
  const ratio = unlimited || limit <= 0 ? 0 : Math.min(1, used / limit);
  const full = !unlimited && limit > 0 && used >= limit;
  const warn = !full && ratio >= 0.8;

  return (
    <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-[#3c4053]">{label}</span>
        <span
          className={cn(
            "text-[14px] font-semibold tabular-nums",
            full ? "text-[#a13a32]" : warn ? "text-[#a16d32]" : "text-[#0b1024]"
          )}
        >
          {unlimited ? "без лимита" : `${used} / ${limit}`}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#ececf4]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200",
            full ? "bg-[#a13a32]" : warn ? "bg-[#d97706]" : "bg-[#5566f6]"
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-[#6f7282]">
        {full ? fullHint : hint}
      </p>
    </div>
  );
}
