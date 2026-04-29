import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/settings/organization
 *
 * Управление общими полями организации (в одной ручке, чтобы форма
 * /settings/organization могла сохранять всё разом без зоопарка
 * endpoint'ов). Принимаем partial — обновляем только заполненные поля.
 *
 * Поля, требующие отдельного flow (платежи, секреты, токены), здесь
 * НЕ принимаем. Они в своих специализированных endpoint'ах:
 *   • externalApiToken → /api/settings/external-token
 *   • yandexDiskToken / accountantEmail → отдельные endpoints
 *   • subscriptionPlan / subscriptionEnd → /api/billing
 *   • requireAdminForJournalEdit / shiftEndHour / lockPastDayEdits →
 *     /api/settings/compliance (оставляем там для back-compat)
 */
const VALID_TYPES = new Set([
  "restaurant",
  "production",
  "retail",
  "catering",
  "school",
  "hospital",
  "other",
]);

const VALID_LOCALES = new Set(["ru", "en"]);

const TIMEZONE_PATTERN = /^[A-Za-z_]+\/[A-Za-z_/-]+$/;

// Принимаем 3- (#abc), 6- (#aabbcc) и 8-знач (#aabbccff) hex —
// иначе legacy-данные с alpha или коротким shorthand блокируют
// сохранение всей формы.
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const URL_PATTERN = /^https?:\/\/.+/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INN_PATTERN = /^\d{10}$|^\d{12}$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{5,}$/;

export async function PATCH(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasCapability(session.user, "admin.full")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) errors.push("Название обязательно");
    else if (name.length > 200) errors.push("Название слишком длинное");
    else data.name = name;
  }
  if ("type" in body) {
    const type = typeof body.type === "string" ? body.type : "";
    if (!VALID_TYPES.has(type)) {
      errors.push(`Тип должен быть одним из: ${[...VALID_TYPES].join(", ")}`);
    } else {
      data.type = type;
    }
  }
  if ("inn" in body) {
    const inn =
      typeof body.inn === "string" ? body.inn.replace(/\s/g, "") : "";
    if (inn === "") {
      data.inn = null;
    } else if (!INN_PATTERN.test(inn)) {
      errors.push("ИНН должен содержать 10 или 12 цифр");
    } else {
      data.inn = inn;
    }
  }
  if ("address" in body) {
    const v = typeof body.address === "string" ? body.address.trim() : "";
    data.address = v === "" ? null : v.slice(0, 500);
  }
  if ("phone" in body) {
    const v = typeof body.phone === "string" ? body.phone.trim() : "";
    if (v === "") {
      data.phone = null;
    } else if (!PHONE_PATTERN.test(v)) {
      errors.push("Телефон в неправильном формате");
    } else {
      data.phone = v.slice(0, 50);
    }
  }
  if ("accountantEmail" in body) {
    const v =
      typeof body.accountantEmail === "string"
        ? body.accountantEmail.trim()
        : "";
    if (v === "") {
      data.accountantEmail = null;
    } else if (!EMAIL_PATTERN.test(v)) {
      errors.push("Email бухгалтера в неправильном формате");
    } else {
      data.accountantEmail = v.slice(0, 200);
    }
  }
  if ("locale" in body) {
    const v = typeof body.locale === "string" ? body.locale : "";
    if (!VALID_LOCALES.has(v)) {
      errors.push("Язык должен быть ru или en");
    } else {
      data.locale = v;
    }
  }
  if ("timezone" in body) {
    const v = typeof body.timezone === "string" ? body.timezone.trim() : "";
    if (v === "") {
      data.timezone = "Europe/Moscow";
    } else if (!TIMEZONE_PATTERN.test(v)) {
      errors.push("Часовой пояс в формате IANA: Europe/Moscow");
    } else {
      data.timezone = v;
    }
  }
  if ("brandColor" in body) {
    const v =
      typeof body.brandColor === "string" ? body.brandColor.trim() : "";
    if (v === "") {
      data.brandColor = null;
    } else if (!HEX_COLOR.test(v)) {
      errors.push("Брендовый цвет в формате #RRGGBB");
    } else {
      data.brandColor = v;
    }
  }
  if ("logoUrl" in body) {
    const v = typeof body.logoUrl === "string" ? body.logoUrl.trim() : "";
    if (v === "") {
      data.logoUrl = null;
    } else if (!URL_PATTERN.test(v)) {
      errors.push("URL логотипа должен начинаться с http:// или https://");
    } else {
      data.logoUrl = v.slice(0, 500);
    }
  }
  if ("shiftEndHour" in body) {
    const h = Number(body.shiftEndHour);
    if (!Number.isFinite(h) || h < 0 || h > 23) {
      errors.push("Час окончания смены должен быть от 0 до 23");
    } else {
      data.shiftEndHour = Math.floor(h);
    }
  }
  if ("lockPastDayEdits" in body) {
    if (typeof body.lockPastDayEdits === "boolean") {
      data.lockPastDayEdits = body.lockPastDayEdits;
    }
  }
  if ("requireAdminForJournalEdit" in body) {
    if (typeof body.requireAdminForJournalEdit === "boolean") {
      data.requireAdminForJournalEdit = body.requireAdminForJournalEdit;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Нет полей для обновления" },
      { status: 400 }
    );
  }

  const updated = await db.organization.update({
    where: { id: getActiveOrgId(session) },
    data,
    select: {
      name: true,
      type: true,
      inn: true,
      address: true,
      phone: true,
      accountantEmail: true,
      locale: true,
      timezone: true,
      brandColor: true,
      logoUrl: true,
      shiftEndHour: true,
      lockPastDayEdits: true,
      requireAdminForJournalEdit: true,
    },
  });

  return NextResponse.json({ ok: true, organization: updated });
}
