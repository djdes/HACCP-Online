/**
 * Промокоды — чистые правила: нормализация, проверка, расчёт скидки.
 * Скидка считается только от цены подписки: оборудование продаётся по
 * себестоимости и промокодами не дисконтируется.
 */
export type PromoRule = {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  newClientsOnly: boolean;
};

export type PromoRejectReason =
  | "not-found"
  | "inactive"
  | "not-started"
  | "expired"
  | "exhausted"
  | "new-clients-only";

export const PROMO_REJECT_MESSAGES: Record<PromoRejectReason, string> = {
  "not-found": "Такого промокода нет",
  inactive: "Промокод отключён",
  "not-started": "Промокод ещё не начал действовать",
  expired: "Срок действия промокода истёк",
  exhausted: "Промокод уже использован максимальное число раз",
  "new-clients-only": "Этот промокод только для новых клиентов",
};

/** Код хранится и сравнивается в верхнем регистре без пробелов. */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidPromoCodeFormat(code: string): boolean {
  return /^[A-Z0-9_-]{3,32}$/.test(code);
}

export function validatePromo(
  rule: PromoRule | null,
  context: { now: Date; paidUses: number; organizationHasPaidOrders: boolean }
): { ok: true } | { ok: false; reason: PromoRejectReason; message: string } {
  const reject = (reason: PromoRejectReason) => ({ ok: false as const, reason, message: PROMO_REJECT_MESSAGES[reason] });
  if (!rule) return reject("not-found");
  if (!rule.active) return reject("inactive");
  if (rule.startsAt && context.now < rule.startsAt) return reject("not-started");
  if (rule.endsAt && context.now > rule.endsAt) return reject("expired");
  if (rule.maxUses != null && context.paidUses >= rule.maxUses) return reject("exhausted");
  if (rule.newClientsOnly && context.organizationHasPaidOrders) return reject("new-clients-only");
  return { ok: true };
}

/** Скидка в рублях от цены подписки; не больше самой цены, целые рубли. */
export function computeDiscountRub(rule: Pick<PromoRule, "kind" | "value">, subscriptionRub: number): number {
  const base = Math.max(0, Math.round(subscriptionRub));
  if (base === 0) return 0;
  if (rule.kind === "percent") {
    const percent = Math.min(100, Math.max(0, rule.value));
    return Math.min(base, Math.round((base * percent) / 100));
  }
  return Math.min(base, Math.max(0, Math.round(rule.value)));
}

export function describeDiscount(rule: Pick<PromoRule, "kind" | "value">): string {
  return rule.kind === "percent" ? `−${rule.value} %` : `−${rule.value.toLocaleString("ru-RU")} ₽`;
}
