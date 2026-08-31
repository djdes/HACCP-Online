/**
 * Лимит бесплатного тарифа и авто-переход на платный.
 *
 * Почему так:
 *  - Раньше лимитов не было вообще: `PLANS.maxUsers` из `src/lib/plans.ts`
 *    никем не читался, а в `Organization.subscriptionPlan` пишутся
 *    совсем другие значения (`trial|paid|paused|cancelled`). Здесь —
 *    единственное место, которое реально решает «бесплатно или нет».
 *  - Блокировать создание сотрудника мы НЕ хотим: сайт в тестовом
 *    режиме, оплата не списывается, а отказ на 6-м человеке убил бы
 *    первое заполнение. Поэтому вместо 402 — тихий перевод на «платный»
 *    с честным toast'ом пользователю.
 */

/** Сколько сотрудников помещается в бесплатный тариф. */
export const FREE_MAX_USERS = 3;

/**
 * Тестовый режим биллинга: тарифы переключаются, но деньги не берутся.
 * Выключается явным `BILLING_TEST_MODE=0` — по умолчанию включён,
 * чтобы никакой недонастроенный энв не начал внезапно требовать оплату.
 */
export const BILLING_TEST_MODE = process.env.BILLING_TEST_MODE !== "0";

/** Значения, которые реально встречаются в `Organization.subscriptionPlan`. */
const PLAN_LABELS: Record<string, string> = {
  trial: "Бесплатный",
  free: "Бесплатный",
  paid: "Платный",
  paused: "Приостановлен",
  cancelled: "Отменён",
};

/** Человекочитаемое название тарифа для UI. */
export function planLabel(plan: string | null | undefined): string {
  const key = (plan ?? "trial").trim();
  return PLAN_LABELS[key] ?? key;
}

/** true — организация ещё на бесплатном тарифе. */
export function isFreePlan(plan: string | null | undefined): boolean {
  const key = (plan ?? "trial").trim();
  return key === "trial" || key === "free";
}
