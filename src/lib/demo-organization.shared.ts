import { sphereLabel } from "@/lib/org-profile";

/**
 * Чистые helper'ы демо-организации — без Prisma, чтобы их могли
 * импортировать клиентские компоненты (баннер, переключатель).
 * Серверная часть (создание, заселение, удаление) — в demo-organization.ts.
 */

export const DEMO_ORG_TTL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Демо — Кафе / Кофейня»: по label сферы из ORG_SPHERES. */
export function demoOrgName(sphere: unknown): string {
  return `Демо — ${sphereLabel(sphere)}`;
}

/** Дата авто-удаления, отсчитанная от `now`. */
export function demoExpiresAtFrom(now: Date): Date {
  return new Date(now.getTime() + DEMO_ORG_TTL_DAYS * DAY_MS);
}

/** Целых дней до удаления, не меньше нуля — для баннера «через N дн.». */
export function demoDaysLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS));
}
