/**
 * Доступность Меркурия по тарифу и настройкам организации.
 *
 * В `src/lib/plans.ts:66` «ФГИС Меркурий» перечислена как возможность
 * старшего тарифа. Общего механизма feature-gate в проекте нет
 * (`plan-limits.ts` умеет только численность), поэтому проверка локальная
 * — если появится общий, эта функция станет его тонкой обёрткой.
 */
import type { AutoProcessMode } from "./types";

/** Тарифы, на которых интеграция доступна. */
const MERCURY_PLANS = new Set(["pro", "business", "enterprise"]);

export function canUseMercury(org: {
  plan?: string | null;
  isDemo?: boolean | null;
}): boolean {
  // Демо-организации показывают фичу целиком: это витрина для продаж.
  if (org.isDemo) return true;
  return MERCURY_PLANS.has((org.plan ?? "").toLowerCase());
}

export function normalizeAutoProcessMode(value: unknown): AutoProcessMode {
  return value === "off" || value === "auto_after_journal" ? value : "assisted";
}

/**
 * Можно ли гасить ВСД автоматически.
 *
 * Возвращает `false` по умолчанию и в любом спорном случае. Гашение —
 * юридически значимое действие уполномоченного лица клиента, и цена
 * ошибки несимметрична: не погасили автоматически — человек погасит
 * руками; погасили зря — в журнале появилась приёмка, которой не было.
 */
export function canAutoProcess(input: {
  mode: AutoProcessMode;
  /** Человек заполнил строку входного контроля и поставил «принять». */
  journalRowAccepted: boolean;
  /** Фактический объём совпал с объёмом из ВСД. */
  volumeMatches: boolean;
  /** ИНН поставщика из ВСД. */
  supplierInn?: string | null;
  /** Белый список ИНН из настроек интеграции. */
  allowedSupplierInns?: string[] | null;
}): { allowed: boolean; reason: string } {
  if (input.mode !== "auto_after_journal") {
    return { allowed: false, reason: "Автогашение выключено" };
  }
  if (!input.journalRowAccepted) {
    return {
      allowed: false,
      reason: "Строка входного контроля ещё не заполнена и не принята",
    };
  }
  if (!input.volumeMatches) {
    return {
      allowed: false,
      reason: "Фактический объём расходится с ВСД — нужно решение человека",
    };
  }
  const allowList = input.allowedSupplierInns ?? [];
  if (allowList.length === 0) {
    return { allowed: false, reason: "Белый список поставщиков пуст" };
  }
  if (!input.supplierInn || !allowList.includes(input.supplierInn)) {
    return {
      allowed: false,
      reason: "Поставщик не в белом списке автогашения",
    };
  }
  return { allowed: true, reason: "" };
}
