/**
 * Per-employee pricing tier — Slack-style: free до N сотрудников,
 * после — фикс. сумма за каждого.
 *
 * Правила:
 *   - 1-5 сотрудников: бесплатно (free)
 *   - 6+: 100₽/мес за каждого активного
 *   - Скидка для сетей: при 30+ сотрудниках — 80₽/чел
 *   - При 100+ — 60₽/чел
 *
 * Идея — маленькая кофейня (3 чел) платит 0, средний ресторан
 * (15 чел) платит 1500₽/мес, сеть на 50 точек × 10 чел = 500 чел =
 * 30000₽/мес.
 *
 * Это helper-расчёт. Биллинг (списание через ЮKassa) — отдельная
 * задача #3.14.3, не реализована.
 */

export type PricingTier = {
  freeUpTo: number;
  pricePerUserRub: number;
  bracketLabel: string;
};

export const PRICING_BRACKETS: PricingTier[] = [
  { freeUpTo: 5, pricePerUserRub: 100, bracketLabel: "малый бизнес (до 30 чел)" },
  { freeUpTo: 5, pricePerUserRub: 80, bracketLabel: "средний (30-99 чел)" },
  { freeUpTo: 5, pricePerUserRub: 60, bracketLabel: "сеть (100+ чел)" },
];

export type PriceCalc = {
  employees: number;
  freeAllowance: number;
  paidEmployees: number;
  pricePerUserRub: number;
  monthlyRub: number;
  yearlyRub: number;
  bracketLabel: string;
  isFree: boolean;
};

export function calculatePerEmployeePrice(employees: number): PriceCalc {
  const tier =
    employees >= 100
      ? PRICING_BRACKETS[2]
      : employees >= 30
        ? PRICING_BRACKETS[1]
        : PRICING_BRACKETS[0];

  const freeAllowance = tier.freeUpTo;
  const paidEmployees = Math.max(0, employees - freeAllowance);
  const monthlyRub = paidEmployees * tier.pricePerUserRub;
  const yearlyRub = monthlyRub * 12;

  return {
    employees,
    freeAllowance,
    paidEmployees,
    pricePerUserRub: tier.pricePerUserRub,
    monthlyRub,
    yearlyRub,
    bracketLabel: tier.bracketLabel,
    isFree: monthlyRub === 0,
  };
}
