import { db } from "@/lib/db";

import {
  computeDiscountRub,
  isValidPromoCodeFormat,
  normalizePromoCode,
  validatePromo,
  type PromoRule,
} from "./rules";

/**
 * Промокод на сервере: найти, проверить, посчитать скидку от цены
 * подписки. Клиенту показываем результат этой же функции — сумма скидки
 * никогда не приходит от браузера.
 */
export type PromoResolution =
  | { ok: true; code: string; discountRub: number; rule: PromoRule }
  | { ok: false; message: string };

export async function resolvePromo(
  raw: string,
  context: { organizationId: string | null; subscriptionRub: number; now?: Date }
): Promise<PromoResolution> {
  const code = normalizePromoCode(raw);
  if (!isValidPromoCodeFormat(code)) return { ok: false, message: "Такого промокода нет" };
  const row = await db.promoCode.findUnique({ where: { code } });
  const rule: PromoRule | null = row
    ? {
        code: row.code,
        kind: row.kind === "fixed" ? "fixed" : "percent",
        value: row.value,
        active: row.active,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        maxUses: row.maxUses,
        newClientsOnly: row.newClientsOnly,
      }
    : null;
  const [paidUses, organizationPaid] = await Promise.all([
    rule ? db.paymentOrder.count({ where: { promoCode: rule.code, status: "paid" } }) : Promise.resolve(0),
    context.organizationId
      ? db.paymentOrder.count({ where: { organizationId: context.organizationId, status: "paid", isTest: false } })
      : Promise.resolve(0),
  ]);
  const verdict = validatePromo(rule, {
    now: context.now ?? new Date(),
    paidUses,
    organizationHasPaidOrders: organizationPaid > 0,
  });
  if (!verdict.ok || !rule) return { ok: false, message: verdict.ok ? "Такого промокода нет" : verdict.message };
  const discountRub = computeDiscountRub(rule, context.subscriptionRub);
  if (discountRub <= 0) return { ok: false, message: "Промокод не даёт скидки на этот тариф" };
  return { ok: true, code: rule.code, discountRub, rule };
}

/** Сколько раз код оплачен — для таблицы ROOT. */
export async function promoPaidUses(codes: string[]): Promise<Record<string, number>> {
  if (codes.length === 0) return {};
  const rows = await db.paymentOrder.groupBy({
    by: ["promoCode"],
    where: { promoCode: { in: codes }, status: "paid" },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) if (row.promoCode) out[row.promoCode] = row._count._all;
  return out;
}
