"use client";

import Link from "next/link";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  CircleArrowUp,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PricingCalculator } from "@/components/public/pricing-calculator";
import {
  LARGE_TEAM_NOTE,
  PLAN_CATALOG,
  TEST_PERIOD_BANNER,
  catalogPlanIdFor,
  type CatalogPlanId,
} from "@/lib/plan-catalog";

/** Что даёт железо — те же три пункта, что в карточке на лендинге. */
const HARDWARE_POINTS = [
  "Датчики в холодильники — температура пишется сама",
  "Планшет на кухне и NFC-брелоки для смены",
  "Выезд, монтаж и обучение смены",
];

type Props = {
  /** Текущее значение `Organization.subscriptionPlan`. */
  currentPlan: string;
  currentPlanLabel: string;
  activeUsers: number;
  freeUserLimit: number;
  /** Тестовый режим биллинга — оплата не списывается. */
  billingTestMode: boolean;
  /** Самый дешёвый комплект железа — считается на сервере. */
  hardwareFromRub: number;
  /** Цена подписки из БД — калькулятор считает с ней общий итог. */
  subscriptionMonthly: number;
};

/**
 * Витрина тарифов на `/settings/subscription`.
 *
 * Тарифов ровно два, поэтому вместо таблицы сравнения — две карточки с
 * кумулятивным списком («Всё из «Бесплатного»» + дельта) и одной умной
 * кнопкой на карточку: менеджер не должен гадать, что ему нажать.
 */
export function PlanUpgrade({
  currentPlan,
  currentPlanLabel,
  activeUsers,
  freeUserLimit,
  billingTestMode,
  hardwareFromRub,
  subscriptionMonthly,
}: Props) {
  const [hardwareOpen, setHardwareOpen] = useState(false);

  const currentId: CatalogPlanId = catalogPlanIdFor(currentPlan);
  const seatsLeft = Math.max(0, freeUserLimit - activeUsers);

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
            Ваш план: {currentPlanLabel}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-[#6f7282]">
            <Users className="size-3.5" />
            {currentId === "free"
              ? `${activeUsers}/${freeUserLimit} сотрудников · свободно мест: ${seatsLeft}`
              : `${activeUsers} сотрудников · без лимита`}
          </p>
        </div>
        {billingTestMode ? (
          <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-[12px] font-medium text-[#116b2a]">
            Тестовый режим — оплата не списывается
          </span>
        ) : null}
      </div>

      {/* Предупреждение ровно на границе: следующий человек меняет тариф. */}
      {currentId === "free" && seatsLeft === 0 ? (
        <p className="mt-4 rounded-2xl border border-[#ffe9b0] bg-[#fffaf0] px-4 py-3 text-[13px] leading-relaxed text-[#3c4053]">
          Бесплатные места закончились. Следующий сотрудник переведёт
          организацию на платный тариф
          {billingTestMode
            ? " — сейчас это бесплатно, сайт в тестовом режиме."
            : "."}
        </p>
      ) : null}

      {/* Тестовый период. Без этой строки человек либо решит, что деньги
          уже списывают, либо не поймёт, что бесплатный доступ конечен. */}
      <p className="mt-4 rounded-2xl border border-[#c7ccea] bg-[#f5f6ff] px-4 py-3 text-[13px] leading-relaxed text-[#3c4053]">
        {TEST_PERIOD_BANNER}
      </p>

      {/* Три колонки, как на лендинге: две тарифные карточки и железо.
          Было sm:grid-cols-2 — третья карточка молча съезжала на вторую
          строку, и ряд тарифов переставал читаться как ряд. Брейкпоинты
          те же, что в equipment-pricing, чтобы витрины не разъезжались. */}
      <div className="mt-5 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PLAN_CATALOG.map((plan) => {
          const isCurrent = plan.id === currentId;
          // Рекомендуем платный только тому, кто ещё на бесплатном —
          // иначе «Рекомендуем» висело бы вечно и перестало значить что-либо.
          const recommended = !isCurrent && plan.id === "paid";
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-2xl border p-5 transition-colors",
                isCurrent && "border-[#ececf4] bg-[#fafbff]",
                recommended &&
                  "border-[#5566f6] bg-[#f5f6ff] ring-2 ring-[#5566f6]/20",
                !isCurrent && !recommended && "border-[#ececf4] bg-white"
              )}
            >
              <div className="flex min-h-6 items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-[#0b1024]">
                  {plan.nameRu}
                </span>
                {isCurrent ? (
                  <span className="rounded-full bg-[#eef1ff] px-2.5 py-0.5 text-[11px] font-medium text-[#3848c7]">
                    Ваш план
                  </span>
                ) : null}
                {recommended ? (
                  <span className="rounded-full bg-[#5566f6] px-2.5 py-0.5 text-[11px] font-medium text-white">
                    Рекомендуем
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-[#0b1024]">
                {plan.price}
                <span className="text-[14px] font-normal text-[#6f7282]">
                  {plan.priceHint}
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#6f7282]">
                {plan.tagline}
              </p>

              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
                Что входит
              </div>
              <ul className="mt-2 flex-1 space-y-1.5 text-[13px]">
                {plan.inheritsFrom ? (
                  <li className="flex gap-2 font-medium text-[#0b1024]">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#5566f6]" />
                    <span>Всё из «{plan.inheritsFrom}»</span>
                  </li>
                ) : null}
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[#3c4053]">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#5566f6]/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.note ? (
                <p className="mt-3 text-[12px] leading-snug text-[#6f7282]">
                  {plan.note}
                </p>
              ) : null}

              <div className="mt-5">
                {plan.id === "free" ? (
                  <button
                    type="button"
                    disabled
                    className={cn(
                      "h-11 w-full rounded-2xl border text-[14px] font-medium",
                      isCurrent
                        ? "border-[#c7ccea] bg-[#eef1ff] text-[#3848c7]"
                        : "border-[#dcdfed] bg-white text-[#9b9fb3]"
                    )}
                  >
                    {isCurrent ? "Текущий" : "Бесплатный тариф"}
                  </button>
                ) : isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white text-[14px] font-medium text-[#9b9fb3]"
                  >
                    Уже улучшено
                  </button>
                ) : (
                  // Сразу на оплату, без промежуточного «вы уверены?»:
                  // подтверждать нечего — деньги спишутся только на
                  // странице оплаты, где всё видно и можно уйти.
                  <Link
                    href="/order?plan=monthly"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors duration-200 hover:bg-[#4a5bf0]"
                  >
                    <CircleArrowUp className="size-4" />
                    Улучшить
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {/* Железо. Кнопка ведёт на лендинг: там живёт калькулятор
            комплектов, дублировать его в кабинете незачем. */}
        <div className="flex flex-col rounded-2xl border border-[#ececf4] bg-white p-5">
          <div className="flex min-h-6 items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-[#0b1024]">
              + Оборудование
            </span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#eef1ff] text-[#5566f6]">
              <Wrench className="size-4" />
            </span>
          </div>

          <div className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-[#0b1024]">
            от {hardwareFromRub.toLocaleString("ru-RU")} ₽
            <span className="text-[14px] font-normal text-[#6f7282]"> разово</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[#6f7282]">
            Чтобы температура писалась сама, а смена отмечалась брелоком
          </p>

          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
            Что входит
          </div>
          <ul className="mt-2 flex-1 space-y-1.5 text-[13px]">
            {HARDWARE_POINTS.map((point) => (
              <li key={point} className="flex gap-2 text-[#3c4053]">
                <Check className="mt-0.5 size-4 shrink-0 text-[#5566f6]/70" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          {/* mt-auto прижимает кнопку к низу: три карточки читаются
              рядом только когда у них совпадает нижняя граница. */}
          <button
            type="button"
            onClick={() => setHardwareOpen((v) => !v)}
            aria-expanded={hardwareOpen}
            aria-controls="hardware-calculator"
            className="mt-auto inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            {hardwareOpen ? "Свернуть подбор" : "Подобрать комплект"}
            <ChevronDown
              className={cn(
                "size-4 text-[#5566f6] transition-transform duration-200",
                hardwareOpen && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {/* Калькулятор раскрывается ПОД тарифами, а не внутри карточки:
          внутри он разносил её высоту вдвое против соседних, и ряд из
          трёх переставал читаться как ряд. Во всю ширину помещаются и
          позиции, и итог. */}
      {hardwareOpen ? (
        <div
          id="hardware-calculator"
          className="mt-5 rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-8"
        >
          <div className="mb-5 max-w-[560px]">
            <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              Подбор оборудования
            </div>
            <p className="mt-1.5 text-[14px] leading-[1.55] text-[#6f7282]">
              Выберите, что нужно — цена пересчитается. Уже есть планшет
              или датчики: снимите галочку, и останется только подписка.
            </p>
          </div>
          <PricingCalculator
            subscriptionMonthly={subscriptionMonthly}
            paymentDisabled
          />
        </div>
      ) : null}

      {/* Команды больше 50 человек считаем индивидуально: тариф с
          фиксированной ценой на них не рассчитан, а молчать об этом
          нельзя — человек оплатит и упрётся в лимит. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3">
        <span className="text-[13px] text-[#3c4053]">{LARGE_TEAM_NOTE}</span>
        <a
          href="https://t.me/wesetupbot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#dcdfed] bg-white px-3.5 text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          Связаться с поддержкой
        </a>
      </div>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-[#6f7282]">
        {billingTestMode
          ? "Оплата появится позже. Сейчас все функции доступны бесплатно — сайт в тестовом режиме."
          : "Тариф можно изменить в любой момент."}
      </p>

    </section>
  );
}
