import { db } from "@/lib/db";
import { NOT_AUTO_SEEDED } from "@/lib/journal-entry-filters";

/**
 * L1 — Baseline-predictor: «вероятность что сегодня compliance не
 * дойдёт до 80%». Без ML, на основе historical patterns:
 *
 *   1. Считаем долю записей которая заполняется к 14:00 по MSK в
 *      обычный день (среднее за 30 дней).
 *   2. Сравниваем с тем что заполнено сегодня к этому часу.
 *   3. Если сегодняшний %-к-14:00 < 70% от исторической средней —
 *      вероятность что не успеют до конца дня — высокая (60-90%).
 *
 * Возвращает score 0-100% (вероятность что compliance НЕ дойдёт),
 * + рекомендацию что делать.
 *
 * Используется в `/api/cron/predict-alerts` (опционально дёргать
 * каждый час с 11 до 15 MSK) — push менеджеру если score > 70%.
 */
export type ComplianceForecast = {
  /** % "вероятность что не дойдём до 80% сегодня". */
  riskScore: number;
  /** Сколько entries за сегодня к моменту проверки. */
  todaySoFar: number;
  /** Среднее за тот же час дня по последним 30 рабочим дням. */
  historicalAvgAtHour: number;
  /** Recommendation: "warn" → push manager, "ok" → silent. */
  level: "ok" | "warn" | "critical";
  hint: string;
};

export async function predictComplianceForecast(
  organizationId: string,
  refDate: Date = new Date()
): Promise<ComplianceForecast> {
  const todayStart = new Date(refDate);
  todayStart.setUTCHours(0, 0, 0, 0);
  const hourOfDay = refDate.getUTCHours();

  // Сегодня — сколько entries уже сделано.
  const [todayField, todayDoc] = await Promise.all([
    db.journalEntry.count({
      where: {
        organizationId,
        createdAt: { gte: todayStart, lte: refDate },
      },
    }),
    db.journalDocumentEntry.count({
      where: {
        document: { organizationId },
        createdAt: { gte: todayStart, lte: refDate },
        ...NOT_AUTO_SEEDED,
      },
    }),
  ]);
  const todaySoFar = todayField + todayDoc;

  // Историческое среднее за last 30 дней — entries в дне до того же часа.
  const since = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [histField, histDoc] = await Promise.all([
    db.journalEntry.findMany({
      where: {
        organizationId,
        createdAt: { gte: since, lt: todayStart },
      },
      select: { createdAt: true },
    }),
    db.journalDocumentEntry.findMany({
      where: {
        document: { organizationId },
        createdAt: { gte: since, lt: todayStart },
        ...NOT_AUTO_SEEDED,
      },
      select: { createdAt: true },
    }),
  ]);

  // Группируем по дням, для каждого дня — entries которые сделаны к
  // hourOfDay часу.
  const perDayCount = new Map<string, number>();
  for (const entries of [histField, histDoc]) {
    for (const e of entries) {
      const dayKey = e.createdAt.toISOString().slice(0, 10);
      const entryHour = e.createdAt.getUTCHours();
      if (entryHour > hourOfDay) continue;
      perDayCount.set(dayKey, (perDayCount.get(dayKey) ?? 0) + 1);
    }
  }
  const counts = [...perDayCount.values()];
  const historicalAvgAtHour =
    counts.length === 0
      ? 0
      : Math.round(counts.reduce((s, n) => s + n, 0) / counts.length);

  // Risk-score: насколько сегодня отстаёт.
  let riskScore: number;
  if (historicalAvgAtHour === 0) {
    riskScore = todaySoFar === 0 ? 50 : 20;
  } else {
    const ratio = todaySoFar / historicalAvgAtHour;
    if (ratio >= 1) riskScore = 10;
    else if (ratio >= 0.7) riskScore = 30;
    else if (ratio >= 0.4) riskScore = 60;
    else riskScore = 90;
  }

  let level: "ok" | "warn" | "critical" = "ok";
  let hint = "Темп заполнения соответствует обычному дню.";
  if (riskScore >= 70) {
    level = "critical";
    hint = `Записей на ${Math.round(
      (1 - todaySoFar / Math.max(1, historicalAvgAtHour)) * 100
    )}% меньше нормы — высокий риск что не дойдёте до 80% к концу дня. Разошлите задачи через bulk-assign сейчас.`;
  } else if (riskScore >= 40) {
    level = "warn";
    hint =
      "Темп ниже среднего — проверьте кто на смене и кто пропускает.";
  }

  return { riskScore, todaySoFar, historicalAvgAtHour, level, hint };
}
