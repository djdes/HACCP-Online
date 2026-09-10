/**
 * Реквизиты организации для шапки и подписи приказа.
 *
 * Источник — `Organization.legalProfileJson`, который заполняется по ИНН
 * через DaData (см. `src/lib/org-legal-profile.ts`). Профиля может не
 * быть: организация зарегистрировалась без ИНН либо справочник ответил
 * ошибкой. Тогда падаем на `Organization.name` и оставляем прочерки —
 * ровно так же ведёт себя бумажный бланк приказа, купленный в
 * типографии, и человек дописывает недостающее ручкой.
 */

import { readLegalProfile } from "@/lib/org-legal-profile";
import type { OrderOrgSnapshot } from "./render";

/** Поля Organization, из которых собирается снимок. */
export type OrgSnapshotSource = {
  name: string;
  inn: string | null;
  address: string | null;
  legalProfileJson: unknown;
};

/**
 * Город из юридического адреса DaData.
 *
 * Адрес приходит одной строкой вида «109012, г Москва, ул Ильинка, д 4».
 * Берём сегмент с маркером населённого пункта. Не нашли — возвращаем
 * null, и в приказе останется прочерк: выдумывать город нельзя, он
 * часть реквизитов документа.
 */
export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((part) => part.trim());
  for (const part of parts) {
    const match = /^(?:г|город|пгт|с|село|д|деревня|рп|ст-ца)\.?\s+(.+)$/i.exec(part);
    if (match) return match[1].trim();
  }
  return null;
}

export function buildOrgSnapshot(org: OrgSnapshotSource): OrderOrgSnapshot {
  const profile = readLegalProfile(org.legalProfileJson);
  const address = profile?.address ?? org.address ?? null;

  return {
    orgName: profile?.nameFull || profile?.nameShort || org.name,
    orgShortName: profile?.nameShort || org.name,
    orgInn: profile?.inn || org.inn || null,
    orgAddress: address,
    directorName: profile?.management?.name ?? null,
    directorPost: profile?.management?.post ?? null,
    city: cityFromAddress(address),
  };
}

/**
 * Разбор снимка, сохранённого в `CompanyOrder.orgSnapshot`.
 *
 * Читаем защитно: строка в базе пережила деплои и могла быть записана
 * более старой версией с другим набором полей.
 */
export function readOrgSnapshot(json: unknown): OrderOrgSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const raw = json as Record<string, unknown>;
  const text = (key: string): string | null => {
    const value = raw[key];
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };
  const orgName = text("orgName");
  const orgShortName = text("orgShortName");
  if (!orgName && !orgShortName) return null;

  return {
    orgName: orgName ?? orgShortName ?? "",
    orgShortName: orgShortName ?? orgName ?? "",
    orgInn: text("orgInn"),
    orgAddress: text("orgAddress"),
    directorName: text("directorName"),
    directorPost: text("directorPost"),
    city: text("city"),
  };
}
