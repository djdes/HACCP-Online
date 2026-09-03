import { FREE_MAX_USERS } from "@/lib/plan-limits";
import { TRIAL_LIMITS } from "@/lib/trial";

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
  /** Мелкая строка под списком — условия тестового периода. */
  note?: string;
};

/**
 * Тестовый период.
 *
 * Пока он идёт, платить не обязательно — и это должно быть написано на
 * каждой витрине, иначе человек либо решит, что с него уже берут деньги,
 * либо, наоборот, не поймёт, что халява кончится.
 */
export const TEST_PERIOD_UNTIL = "1 октября";

/**
 * Условие платного тарифа — стоит НАД кнопкой оплаты.
 *
 * Общего баннера над витриной больше нет: он повторял то же самое ещё
 * раз и отодвигал сами тарифы вниз. Условие каждого тарифа читается там,
 * где по нему принимают решение — рядом с его кнопкой.
 */
export const PAID_PLAN_TEST_NOTE =
  `Сейчас тариф работает бесплатно. Оплатив до ${TEST_PERIOD_UNTIL}, вы ` +
  "поддерживаете проект — за это дадим дополнительные скидки и бонусы.";

export const FREE_PLAN_TEST_NOTE =
  `Сейчас тестовый режим до ${TEST_PERIOD_UNTIL} — сотрудников можно добавлять ` +
  "без ограничений.";

/** Сколько сотрудников покрывает платная подписка. */
export const SUBSCRIPTION_MAX_USERS = 30;

/** Каждый сотрудник сверх `SUBSCRIPTION_MAX_USERS` — фиксированная доплата в месяц. */
export const EXTRA_USER_PRICE_RUB = 100;

/** Одна фраза для витрины, блока тарифов и кабинета — чтобы цена не разошлась. */
export const LARGE_TEAM_NOTE =
  `Каждый сотрудник сверх ${SUBSCRIPTION_MAX_USERS} — ${EXTRA_USER_PRICE_RUB} ₽/мес.`;

export const PLAN_CATALOG: CatalogPlan[] = [
  {
    id: "free",
    matches: ["trial", "free"],
    nameRu: "Бесплатный",
    price: "0 ₽",
    priceHint: "/мес",
    tagline: "Всё нужное для маленькой кухни — без оплаты и навсегда",
    note: FREE_PLAN_TEST_NOTE,
    features: [
      `До ${FREE_MAX_USERS} сотрудников`,
      "Все 35 журналов СанПиН и ХАССП",
      "Telegram-бот и Mini App",
      "PDF-отчёты для проверки",
      `До ${TRIAL_LIMITS.entriesPerDay} записей в день, ${TRIAL_LIMITS.tuyaSensors} датчика и ${TRIAL_LIMITS.aiMessagesPerMonth} AI-сообщений в месяц`,
    ],
  },
  {
    id: "paid",
    matches: ["paid"],
    nameRu: "Подписка",
    price: "1 990 ₽",
    priceHint: "/мес",
    tagline: "Для команды до 30 человек и автоматического заполнения",
    inheritsFrom: "Бесплатного",
    note: PAID_PLAN_TEST_NOTE,
    features: [
      `До ${SUBSCRIPTION_MAX_USERS} сотрудников`,
      "Свои IoT-датчики и автозаполнение",
      "Без дневного лимита записей и лимита датчиков",
      "Приоритетная поддержка в Telegram",
    ],
  },
];

/** Какой карточке витрины соответствует текущее значение из БД. */
export function catalogPlanIdFor(plan: string | null | undefined): CatalogPlanId {
  const key = (plan ?? "trial").trim();
  return PLAN_CATALOG.find((p) => p.matches.includes(key))?.id ?? "free";
}
