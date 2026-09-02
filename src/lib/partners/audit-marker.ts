import type { PrismaClient } from "@prisma/client";

import { PARTNER_HEADER_PARTNER_ID } from "./request-context";

/**
 * Подпись действий партнёра в журнале аудита клиента:
 * «партнёр: <бренд>, <ФИО>». Читается из заголовков запроса (их выставляет
 * middleware) — вне запроса (cron, скрипты) маркера нет.
 */
export type PartnerAuditMarker = {
  partnerId: string;
  brandName: string;
  userName: string;
  label: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const brandCache = new Map<string, { value: string; expires: number }>();

export function invalidatePartnerBrandCache(partnerId: string) {
  brandCache.delete(partnerId);
}

async function readBrandName(client: PrismaClient, partnerId: string): Promise<string | null> {
  const cached = brandCache.get(partnerId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const partner = await client.partner.findUnique({
    where: { id: partnerId },
    select: { companyName: true, branding: { select: { brandName: true } } },
  });
  if (!partner) return null;
  const value = partner.branding?.brandName ?? partner.companyName;
  brandCache.set(partnerId, { value, expires: Date.now() + CACHE_TTL_MS });
  return value;
}

export function partnerAuditLabel(brandName: string, userName: string): string {
  return `партнёр: ${brandName}, ${userName}`;
}

/**
 * `userId`/`userName` — те, что обработчик уже положил в запись аудита
 * (это партнёрский пользователь, вошедший как «owner» клиента).
 */
export async function resolvePartnerAuditMarker(
  client: PrismaClient,
  input: { userId?: string | null; userName?: string | null },
): Promise<PartnerAuditMarker | null> {
  let partnerId: string | null = null;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    partnerId = h.get(PARTNER_HEADER_PARTNER_ID);
  } catch {
    return null;
  }
  if (!partnerId) return null;
  const brandName = await readBrandName(client, partnerId);
  if (!brandName) return null;
  let userName = input.userName?.trim() || "";
  if (!userName && input.userId) {
    const user = await client.user.findUnique({
      where: { id: input.userId },
      select: { name: true, email: true },
    });
    userName = user?.name?.trim() || user?.email || "";
  }
  if (!userName) userName = "сотрудник партнёра";
  return { partnerId, brandName, userName, label: partnerAuditLabel(brandName, userName) };
}
