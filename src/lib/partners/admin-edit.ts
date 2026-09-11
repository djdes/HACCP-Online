/**
 * Правка партнёра из админки платформы.
 *
 * Зачем: партнёр заполняет анкету один раз, и опечатка в названии, ИНН
 * или почте превращалась в тупик — в кабинете эти поля уже не меняются,
 * а в админке их вообще нельзя было тронуть. Теперь администратор
 * поправит всё, о чём его попросили, а не только статус и договор.
 *
 * Принципы:
 * - меняем только присланные поля («пустой PATCH — 400», а не «затереть
 *   всё пустыми строками»);
 * - валидируем теми же функциями, что и кабинет партнёра, иначе админка
 *   и кабинет разойдутся в правилах;
 * - возвращаем «было → стало», чтобы роут записал это в аудит.
 */

import { db } from "@/lib/db";

import { invalidateOrgBranding, invalidatePartnerBranding } from "./branding";
import { PartnerError } from "./errors";
import {
  isSlugAvailable,
  parsePayoutDetails,
  PARTNER_TYPES,
  type PayoutDetails,
} from "./service";
import { BRAND_NAME_MAX, isValidInn, validateSlug } from "./validation";

/** Поля, которые администратор может изменить. Все необязательные. */
export type PartnerAdminPatch = {
  companyName?: string;
  brandName?: string;
  type?: string;
  inn?: string;
  city?: string;
  phone?: string;
  telegram?: string | null;
  contactEmail?: string;
  venuesCount?: number;
  slug?: string;
  agreementNumber?: string | null;
  payoutType?: string;
  payoutDetails?: unknown;
};

/** Снимок для аудита: одинаковый набор ключей до и после правки. */
export type PartnerAdminSnapshot = Record<string, unknown>;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Счёт и ИНН в аудите — маскированные. Журнал читают несколько человек,
 * и полные банковские реквизиты в нём хранить незачем: для разбора
 * спора хватает «менялись ли они и на какой хвост».
 */
function maskTail(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

function payoutSnapshot(payoutType: string | null, details: unknown): PartnerAdminSnapshot {
  const parsed = (details && typeof details === "object" ? details : {}) as Record<string, unknown>;
  return {
    payoutType,
    payoutFullName: typeof parsed.fullName === "string" ? parsed.fullName : null,
    payoutBank: typeof parsed.bank === "string" ? parsed.bank : null,
    payoutInn: maskTail(parsed.inn),
    payoutBik: maskTail(parsed.bik),
    payoutAccount: maskTail(parsed.account),
  };
}

/**
 * Разбирает тело запроса. Ключ, которого нет в теле, не попадает в
 * результат — значит поле не трогаем. Пустая строка там, где поле
 * обязательное, — ошибка, а не «стереть».
 */
export function parsePartnerAdminPatch(raw: unknown): PartnerAdminPatch {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const patch: PartnerAdminPatch = {};

  if ("companyName" in body) {
    const value = text(body.companyName, 120);
    if (value.length < 2) throw new PartnerError("Укажите название компании");
    patch.companyName = value;
  }
  if ("brandName" in body) {
    const value = text(body.brandName, BRAND_NAME_MAX);
    if (value.length < 2) throw new PartnerError("Укажите вывеску — её видят клиенты");
    patch.brandName = value;
  }
  if ("type" in body) {
    const value = text(body.type, 32);
    if (!(PARTNER_TYPES as readonly string[]).includes(value)) {
      throw new PartnerError("Выберите тип партнёра");
    }
    patch.type = value;
  }
  if ("inn" in body) {
    const value = text(body.inn, 12).replace(/\D/g, "");
    if (!isValidInn(value)) throw new PartnerError("ИНН — 10 или 12 цифр");
    patch.inn = value;
  }
  if ("city" in body) {
    const value = text(body.city, 80);
    if (value.length < 2) throw new PartnerError("Укажите город");
    patch.city = value;
  }
  if ("phone" in body) {
    const value = text(body.phone, 32);
    if (value.replace(/\D/g, "").length < 10) throw new PartnerError("Укажите телефон");
    patch.phone = value;
  }
  if ("telegram" in body) {
    patch.telegram = text(body.telegram, 64) || null;
  }
  if ("contactEmail" in body) {
    const value = text(body.contactEmail, 160).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw new PartnerError("Укажите корректную почту");
    patch.contactEmail = value;
  }
  if ("venuesCount" in body) {
    patch.venuesCount = Math.max(0, Math.min(100000, Math.floor(Number(body.venuesCount) || 0)));
  }
  if ("slug" in body) {
    const checked = validateSlug(text(body.slug, 64));
    if (!checked.ok) throw new PartnerError(checked.error);
    patch.slug = checked.slug;
  }
  if ("agreementNumber" in body) {
    patch.agreementNumber = text(body.agreementNumber, 64) || null;
  }
  // Реквизиты приходят и проверяются только парой: тип получателя задаёт
  // правила для ИНН, КПП и ОГРН, поэтому по отдельности они бессмысленны.
  if ("payoutType" in body || "payoutDetails" in body) {
    if (!("payoutType" in body) || !("payoutDetails" in body)) {
      throw new PartnerError("Реквизиты меняются целиком: тип получателя и поля вместе");
    }
    patch.payoutType = String(body.payoutType);
    patch.payoutDetails = body.payoutDetails;
  }

  if (Object.keys(patch).length === 0) throw new PartnerError("Нечего менять");
  return patch;
}

/**
 * Применяет правку. Возвращает снимки «было» и «стало» с одинаковым
 * набором ключей — роут кладёт их в аудит как есть.
 */
export async function updatePartnerAsAdmin(
  partnerId: string,
  patch: PartnerAdminPatch,
): Promise<{ before: PartnerAdminSnapshot; after: PartnerAdminSnapshot }> {
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      slug: true,
      companyName: true,
      type: true,
      inn: true,
      city: true,
      phone: true,
      telegram: true,
      contactEmail: true,
      venuesCount: true,
      agreementNumber: true,
      payoutType: true,
      payoutDetails: true,
      branding: { select: { brandName: true } },
      clients: { where: { detachedAt: null }, select: { organizationId: true } },
    },
  });
  if (!partner) throw new PartnerError("Партнёр не найден", 404);

  if (patch.slug && patch.slug !== partner.slug) {
    if (!(await isSlugAvailable(patch.slug, partnerId))) {
      throw new PartnerError("Такая ссылка уже занята или зарезервирована", 409, "slug_taken");
    }
  }

  let payout: { payoutType: string; details: PayoutDetails } | null = null;
  if (patch.payoutType !== undefined) {
    const parsed = parsePayoutDetails(patch.payoutType, patch.payoutDetails);
    payout = { payoutType: parsed.payoutType, details: parsed.details };
  }

  const before: PartnerAdminSnapshot = {
    companyName: partner.companyName,
    brandName: partner.branding?.brandName ?? null,
    type: partner.type,
    inn: partner.inn,
    city: partner.city,
    phone: partner.phone,
    telegram: partner.telegram,
    contactEmail: partner.contactEmail,
    venuesCount: partner.venuesCount,
    slug: partner.slug,
    agreementNumber: partner.agreementNumber,
    ...payoutSnapshot(partner.payoutType, partner.payoutDetails),
  };

  const updated = await db.partner.update({
    where: { id: partnerId },
    data: {
      ...(patch.companyName !== undefined ? { companyName: patch.companyName } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.inn !== undefined ? { inn: patch.inn } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.telegram !== undefined ? { telegram: patch.telegram } : {}),
      ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail } : {}),
      ...(patch.venuesCount !== undefined ? { venuesCount: patch.venuesCount } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.agreementNumber !== undefined ? { agreementNumber: patch.agreementNumber } : {}),
      ...(payout
        ? {
            payoutType: payout.payoutType,
            payoutDetails: payout.details as unknown as object,
          }
        : {}),
    },
    select: {
      slug: true,
      companyName: true,
      type: true,
      inn: true,
      city: true,
      phone: true,
      telegram: true,
      contactEmail: true,
      venuesCount: true,
      agreementNumber: true,
      payoutType: true,
      payoutDetails: true,
    },
  });

  // Вывеску правим только когда её прислали: `brandName` живёт в
  // отдельной таблице и по умолчанию подставляется из `companyName`,
  // поэтому строку брендинга нельзя заводить «за компанию».
  let brandName = partner.branding?.brandName ?? null;
  if (patch.brandName !== undefined && patch.brandName !== brandName) {
    await db.partnerBranding.upsert({
      where: { partnerId },
      create: { partnerId, brandName: patch.brandName },
      update: { brandName: patch.brandName, version: { increment: 1 } },
    });
    brandName = patch.brandName;
    invalidatePartnerBranding(partnerId);
    // Вывеска видна в кабинетах клиентов — их кэш брендинга тоже устарел.
    for (const client of partner.clients) invalidateOrgBranding(client.organizationId);
  }

  const after: PartnerAdminSnapshot = {
    companyName: updated.companyName,
    brandName,
    type: updated.type,
    inn: updated.inn,
    city: updated.city,
    phone: updated.phone,
    telegram: updated.telegram,
    contactEmail: updated.contactEmail,
    venuesCount: updated.venuesCount,
    slug: updated.slug,
    agreementNumber: updated.agreementNumber,
    ...payoutSnapshot(updated.payoutType, updated.payoutDetails),
  };

  return { before, after };
}

/** Изменились ли банковские реквизиты — от этого зависит письмо партнёру. */
export function payoutChanged(
  before: PartnerAdminSnapshot,
  after: PartnerAdminSnapshot,
): boolean {
  const keys = [
    "payoutType",
    "payoutFullName",
    "payoutBank",
    "payoutInn",
    "payoutBik",
    "payoutAccount",
  ];
  return keys.some((key) => before[key] !== after[key]);
}
