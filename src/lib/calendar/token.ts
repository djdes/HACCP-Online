import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Ссылка на календарь — личный секрет пользователя: календарные
 * программы ходят по ней без сессии. Токен хранится как есть (его надо
 * отдавать обратно в настройках), поэтому он длинный и случайный, а
 * «Перевыпустить» сразу гасит старую ссылку.
 */
export const CALENDAR_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export function generateCalendarToken(): string {
  return randomBytes(24).toString("base64url");
}

export function calendarFeedUrl(token: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "https://wesetup.ru").replace(/\/+$/, "");
  return `${base}/api/calendar/${token}.ics`;
}

export async function rotateCalendarToken(userId: string): Promise<string> {
  const token = generateCalendarToken();
  await db.user.update({ where: { id: userId }, data: { calendarToken: token } });
  return token;
}

export async function revokeCalendarToken(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { calendarToken: null } });
}

export async function resolveCalendarUser(token: string) {
  if (!CALENDAR_TOKEN_RE.test(token)) return null;
  return db.user.findUnique({
    where: { calendarToken: token },
    select: {
      id: true,
      organizationId: true,
      role: true,
      isRoot: true,
      isActive: true,
      organization: { select: { name: true } },
    },
  });
}
