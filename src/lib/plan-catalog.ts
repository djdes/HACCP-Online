import { FREE_MAX_USERS } from "@/lib/plan-limits";
import { PRICING_BRACKETS } from "@/lib/per-employee-pricing";

/**
 * Витрина тарифов — единственное место копирайта для `/settings/subscription`.
 *
 * Почему отдельно от `src/lib/plans.ts`: там лежат мёртвые starter/standard/pro,
 * которые никогда не писались в `Organization.subscriptionPlan`. Реальных
 * тарифов два — бесплатный (`trial`) и платный (`paid`), и витрина
 * описывает именно их.
 */

export type CatalogPlanId = "free" | "paid";

export type CatalogPlan = {
  id: CatalogPlanId;
  /** Значения `Organization.subscriptionPlan`, которые считаются этим тарифом. */
  matches: string[];
  nameRu: string;
  /** Цена строкой: у платного она зависит от численности, числом не выразить. */
  price: string;
  priceHint: string;
  tagline: string;
  /** Кумулятивная витрина: у платного показываем «Всё из «Бесплатного»» + дельту. */
  inheritsFrom?: string;
  features: string[];
};

const bracketLadder = PRICING_BRACKETS.map((b) => b.pricePerUserRub).join("/");

export const PLAN_CATALOG: CatalogPlan[] = [
  {
    id: "free",
    matches: ["trial", "free"],
    nameRu: "Бесплатный",
    price: "0 ₽",
    priceHint: "/мес",
    tagline: "Всё нужное для маленькой кухни — без оплаты и навсегда",
    features: [
      `До ${FREE_MAX_USERS} сотрудников`,
      "Все 35 журналов СанПиН и ХАССП",
      "Telegram-бот и Mini App",
      "PDF-отчёты для проверки",
    ],
  },
  {
    id: "paid",
    matches: ["paid"],
    nameRu: "Платный",
    price: `от ${PRICING_BRACKETS[0].pricePerUserRub} ₽`,
    priceHint: "/сотрудник/мес",
    tagline: "Для команды больше пяти человек и автоматического заполнения",
    inheritsFrom: "Бесплатного",
    features: [
      "Без лимита сотрудников",
      `Лестница цен ${bracketLadder} ₽ — чем больше команда, тем дешевле человек`,
      "Датчики и автозаполнение температурных журналов",
      "Приоритетная поддержка",
    ],
  },
];

/** Какой карточке витрины соответствует текущее значение из БД. */
export function catalogPlanIdFor(plan: string | null | undefined): CatalogPlanId {
  const key = (plan ?? "trial").trim();
  return PLAN_CATALOG.find((p) => p.matches.includes(key))?.id ?? "free";
}
