import { isFreePlan } from "@/lib/plan-limits";
import { pluralRu } from "@/lib/plural-ru";

/**
 * Тестовый период (sandbox) бесплатного тарифа — чистая логика без БД.
 *
 * Свежая организация живёт на `subscriptionPlan: "trial"` `TRIAL_DAYS`
 * дней с мягкими лимитами. Дата окончания хранится в
 * `Organization.subscriptionEnd` (ставится при регистрации, ROOT может
 * продлить в карточке организации); если её нет — считаем от
 * `createdAt`. После окончания дашборд предлагает «продлить» (оформить
 * подписку) или «сократить функционал» (остаться на бесплатном —
 * `subscriptionPlan: "free"`, лимиты те же, отсчёт больше не идёт).
 *
 * Серверная часть (счётчик записей, гейты) — `trial-limits.server.ts`:
 * этот файл читают и клиентские компоненты, `db` сюда тянуть нельзя.
 */

export const TRIAL_DAYS = 14;

/** Мягкие лимиты бесплатного тарифа (trial и free). */
export const TRIAL_LIMITS = {
  /** Ручных записей в журналы за день (по таймзоне организации). */
  entriesPerDay: 50,
  /** Привязанных Tuya-датчиков на организацию. */
  tuyaSensors: 3,
  /** AI-сообщений в месяц — см. `Organization.aiMonthlyQuota`. */
  aiMessagesPerMonth: 20,
} as const;

export const TRIAL_DAILY_LIMIT_CODE = "trial_daily_limit";
export const TRIAL_SENSOR_LIMIT_CODE = "trial_sensor_limit";

export type TrialPhase =
  /** Идёт тестовый период. */
  | "trial"
  /** Тест закончился, решение ещё не принято. */
  | "expired"
  /** Остались на бесплатном после теста. */
  | "free"
  /** Платный тариф — лимиты не действуют. */
  | "paid"
  /** paused / cancelled — у них своя логика, лимиты теста не про них. */
  | "other";

export type TrialStatus = {
  plan: string;
  phase: TrialPhase;
  /** Действуют ли мягкие лимиты бесплатного тарифа. */
  limited: boolean;
  startedAt: Date | null;
  endsAt: Date | null;
  /** Дней до конца теста, округляя вверх. 0 — тест закончился. */
  daysLeft: number;
  /** Порядковый день теста (1 — день регистрации). После конца растёт дальше. */
  dayNumber: number;
};

export type TrialOrgInput = {
  subscriptionPlan: string | null | undefined;
  subscriptionEnd: Date | string | null | undefined;
  createdAt: Date | string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function trialEndsAt(org: TrialOrgInput): Date {
  if (org.subscriptionEnd) {
    const end = toDate(org.subscriptionEnd);
    if (Number.isFinite(end.getTime())) return end;
  }
  return new Date(toDate(org.createdAt).getTime() + TRIAL_DAYS * DAY_MS);
}

export function getTrialStatus(
  org: TrialOrgInput,
  now: Date = new Date()
): TrialStatus {
  const plan = (org.subscriptionPlan ?? "trial").trim() || "trial";

  if (plan === "trial") {
    const startedAt = toDate(org.createdAt);
    const endsAt = trialEndsAt(org);
    const msLeft = endsAt.getTime() - now.getTime();
    const expired = msLeft <= 0;
    return {
      plan,
      phase: expired ? "expired" : "trial",
      limited: true,
      startedAt,
      endsAt,
      daysLeft: expired ? 0 : Math.ceil(msLeft / DAY_MS),
      dayNumber:
        Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS)) + 1,
    };
  }

  const phase: TrialPhase = isFreePlan(plan)
    ? "free"
    : plan === "paid"
      ? "paid"
      : "other";
  return {
    plan,
    phase,
    limited: phase === "free",
    startedAt: null,
    endsAt: null,
    daysLeft: 0,
    dayNumber: 0,
  };
}

export type TrialWriteDecision = {
  allowed: boolean;
  /** Сколько записей будет использовано после этой операции. */
  used: number;
  limit: number;
  /** Лимит превышен, но не блокируем (тестовый режим биллинга). */
  softExceeded: boolean;
};

/**
 * Решение «пустить ли ещё `count` записей». Отделено от БД ради тестов.
 *
 * В тестовом режиме биллинга не блокируем — как и лимит на сотрудников
 * (`ensurePlanForHeadcount`): сайт обещает «пока оплата не требуется».
 */
export function decideTrialWrite(args: {
  limited: boolean;
  used: number;
  count: number;
  testMode: boolean;
  limit?: number;
}): TrialWriteDecision {
  const limit = args.limit ?? TRIAL_LIMITS.entriesPerDay;
  const count = Math.max(1, Math.trunc(args.count));
  const nextUsed = args.used + count;
  if (!args.limited) {
    return { allowed: true, used: nextUsed, limit, softExceeded: false };
  }
  const exceeded = nextUsed > limit;
  if (exceeded && !args.testMode) {
    return { allowed: false, used: args.used, limit, softExceeded: false };
  }
  return { allowed: true, used: nextUsed, limit, softExceeded: exceeded };
}

export function formatDaysRu(days: number): string {
  return `${days} ${pluralRu(days, "день", "дня", "дней")}`;
}

/** «осталось 9 дней» / «последний день» / «закончился». */
export function trialDaysLeftLabel(status: TrialStatus): string {
  if (status.phase === "expired") return "закончился";
  if (status.daysLeft <= 1) return "последний день";
  return `осталось ${formatDaysRu(status.daysLeft)}`;
}

export function formatTrialEndDate(endsAt: Date | null): string {
  if (!endsAt) return "";
  return endsAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function trialDailyLimitMessage(
  limit: number = TRIAL_LIMITS.entriesPerDay
): string {
  return (
    `Дневной лимит бесплатного тарифа исчерпан: ${limit} записей. ` +
    "Журналы открыты для просмотра и печати, новые записи можно вносить " +
    "завтра — или без лимита сразу после перехода на подписку " +
    "(Настройки → Тарифы и оплата)."
  );
}

export function trialSensorLimitMessage(
  limit: number = TRIAL_LIMITS.tuyaSensors
): string {
  return (
    `На бесплатном тарифе можно привязать до ${limit} датчиков. ` +
    "Отвяжите один из существующих или перейдите на подписку " +
    "(Настройки → Тарифы и оплата)."
  );
}
