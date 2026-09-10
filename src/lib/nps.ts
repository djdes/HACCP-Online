/**
 * NPS: один вопрос раз в 90 дней руководителю организации старше двух недель.
 * Чистые правила здесь, база — в `nps-data.ts`.
 */
export const NPS_ASK_EVERY_MS = 90 * 24 * 60 * 60 * 1000;
export const NPS_MIN_ORG_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function shouldAskNps(input: { orgCreatedAt: Date; npsAskedAt: Date | null; now: Date }): boolean {
  if (input.now.getTime() - input.orgCreatedAt.getTime() < NPS_MIN_ORG_AGE_MS) return false;
  if (!input.npsAskedAt) return true;
  return input.now.getTime() - input.npsAskedAt.getTime() >= NPS_ASK_EVERY_MS;
}

export function isNpsScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;
}

export type NpsSummary = { total: number; promoters: number; passives: number; detractors: number; nps: number | null; average: number | null };

export function computeNps(scores: number[]): NpsSummary {
  const total = scores.length;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = total - promoters - detractors;
  if (total === 0) return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: null, average: null };
  return {
    total,
    promoters,
    passives,
    detractors,
    nps: Math.round(((promoters - detractors) / total) * 100),
    average: Math.round((scores.reduce((s, v) => s + v, 0) / total) * 10) / 10,
  };
}
