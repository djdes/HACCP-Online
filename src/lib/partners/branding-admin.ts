import { db } from "@/lib/db";

import { invalidatePartnerBranding, logoUrlFor } from "./branding";
import { PartnerError } from "./errors";
import { sanitizeSvg } from "./svg-sanitize";
import {
  BRAND_NAME_MAX,
  LOGIN_GREETING_MAX,
  LOGO_BOX,
  LOGO_MAX_BYTES,
  PDF_SIGNATURE_MAX,
  checkAccent,
  checkLogoBytes,
  clampText,
  validateBrandName,
  type AccentCheck,
} from "./validation";

/**
 * Настройки брендинга со стороны партнёра (раздел «Брендинг»).
 * Чтение — форма; запись — валидация + version++ + сброс кэша, чтобы
 * клиенты увидели изменения не позже чем через 5 минут (в рамках
 * процесса — сразу).
 */

export type LogoVariant = "light" | "dark";
export const LOGO_VARIANTS: readonly LogoVariant[] = ["light", "dark"] as const;

export function isLogoVariant(value: unknown): value is LogoVariant {
  return value === "light" || value === "dark";
}

export type BrandingSettings = {
  brandName: string;
  accentColor: string;
  accent: AccentCheck | null;
  supportPhone: string;
  supportTelegram: string;
  supportEmail: string;
  pdfSignature: string;
  loginGreeting: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  version: number;
  limits: {
    brandName: number;
    pdfSignature: number;
    loginGreeting: number;
    logoBytes: number;
    logoBox: { width: number; height: number };
  };
};

const LIMITS = {
  brandName: BRAND_NAME_MAX,
  pdfSignature: PDF_SIGNATURE_MAX,
  loginGreeting: LOGIN_GREETING_MAX,
  logoBytes: LOGO_MAX_BYTES,
  logoBox: { width: LOGO_BOX.width, height: LOGO_BOX.height },
};

export async function getBrandingSettings(partnerId: string): Promise<BrandingSettings> {
  const partner = await db.partner.findUnique({
    where: { id: partnerId },
    select: {
      companyName: true,
      phone: true,
      telegram: true,
      contactEmail: true,
      branding: {
        select: {
          brandName: true,
          accentColor: true,
          supportPhone: true,
          supportTelegram: true,
          supportEmail: true,
          pdfSignature: true,
          loginGreeting: true,
          logoLightMime: true,
          logoDarkMime: true,
          version: true,
        },
      },
    },
  });
  if (!partner) throw new PartnerError("Партнёр не найден", 404);
  const b = partner.branding;
  const ref = { partnerId, version: b?.version ?? 1 };
  return {
    brandName: b?.brandName ?? partner.companyName,
    accentColor: b?.accentColor ?? "",
    accent: b?.accentColor ? checkAccent(b.accentColor) : null,
    supportPhone: b?.supportPhone ?? partner.phone,
    supportTelegram: b?.supportTelegram ?? partner.telegram ?? "",
    supportEmail: b?.supportEmail ?? partner.contactEmail,
    pdfSignature: b?.pdfSignature ?? "",
    loginGreeting: b?.loginGreeting ?? "",
    logoLightUrl: b?.logoLightMime ? logoUrlFor(ref, "light") : null,
    logoDarkUrl: b?.logoDarkMime ? logoUrlFor(ref, "dark") : null,
    version: ref.version,
    limits: LIMITS,
  };
}

export type BrandingInput = {
  brandName?: unknown;
  accentColor?: unknown;
  supportPhone?: unknown;
  supportTelegram?: unknown;
  supportEmail?: unknown;
  pdfSignature?: unknown;
  loginGreeting?: unknown;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeTelegram(raw: string): string {
  const v = raw.trim().replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/^@/, "");
  return v ? `@${v.slice(0, 64)}` : "";
}

/** Сохраняет настройки; возвращает результат проверки акцента для подсказки в UI. */
export async function updateBrandingSettings(
  partnerId: string,
  input: BrandingInput,
): Promise<{ accent: AccentCheck | null }> {
  const name = validateBrandName(str(input.brandName));
  if (!name.ok) throw new PartnerError(name.error);

  const accentRaw = str(input.accentColor).trim();
  const accent = accentRaw ? checkAccent(accentRaw) : null;
  if (accent && !accent.hex) throw new PartnerError(accent.warning ?? "Неверный цвет");

  const supportEmail = clampText(str(input.supportEmail), 120).toLowerCase();
  if (supportEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supportEmail)) {
    throw new PartnerError("Почта поддержки указана с ошибкой");
  }
  const supportPhone = clampText(str(input.supportPhone), 32);
  if (supportPhone && supportPhone.replace(/\D/g, "").length < 10) {
    throw new PartnerError("Телефон поддержки — не короче 10 цифр");
  }

  const data = {
    brandName: name.value,
    accentColor: accent?.hex ?? null,
    supportPhone: supportPhone || null,
    supportTelegram: normalizeTelegram(str(input.supportTelegram)) || null,
    supportEmail: supportEmail || null,
    pdfSignature: clampText(str(input.pdfSignature), PDF_SIGNATURE_MAX) || null,
    loginGreeting: clampText(str(input.loginGreeting), LOGIN_GREETING_MAX) || null,
  };

  await db.partnerBranding.upsert({
    where: { partnerId },
    create: { partnerId, ...data },
    update: { ...data, version: { increment: 1 } },
  });
  invalidatePartnerBranding(partnerId);
  return { accent };
}

/**
 * Логотип: PNG (размер проверяем по заголовку) или SVG (после sanitize).
 * Подгонка PNG под 240×64 делается в браузере перед загрузкой — на
 * сервере нет image-библиотек, поэтому здесь только верхняя граница.
 */
export async function setPartnerLogo(input: {
  partnerId: string;
  variant: LogoVariant;
  bytes: Uint8Array;
  declaredMime: string;
}): Promise<{ url: string; mime: string }> {
  const check = checkLogoBytes(input.bytes, input.declaredMime);
  if (!check.ok) throw new PartnerError(check.error);

  let stored: Uint8Array = input.bytes;
  if (check.mime === "image/svg+xml") {
    const text = new TextDecoder("utf-8").decode(input.bytes);
    const clean = sanitizeSvg(text);
    if (!clean.ok) throw new PartnerError(clean.error);
    stored = new TextEncoder().encode(clean.svg);
  }

  // Prisma Bytes хочет Uint8Array поверх ArrayBuffer — копия отвязывает от Blob/Buffer.
  const payload = Uint8Array.from(stored);
  const columns =
    input.variant === "light"
      ? { logoLight: payload, logoLightMime: check.mime }
      : { logoDark: payload, logoDarkMime: check.mime };

  const partner = await db.partner.findUnique({ where: { id: input.partnerId }, select: { companyName: true } });
  if (!partner) throw new PartnerError("Партнёр не найден", 404);

  const row = await db.partnerBranding.upsert({
    where: { partnerId: input.partnerId },
    create: { partnerId: input.partnerId, brandName: partner.companyName, ...columns },
    update: { ...columns, version: { increment: 1 } },
    select: { version: true },
  });
  invalidatePartnerBranding(input.partnerId);
  return { url: logoUrlFor({ partnerId: input.partnerId, version: row.version }, input.variant), mime: check.mime };
}

export async function removePartnerLogo(partnerId: string, variant: LogoVariant): Promise<void> {
  const columns =
    variant === "light" ? { logoLight: null, logoLightMime: null } : { logoDark: null, logoDarkMime: null };
  const result = await db.partnerBranding.updateMany({ where: { partnerId }, data: { ...columns, version: { increment: 1 } } });
  if (result.count === 0) throw new PartnerError("Логотип не загружен", 404);
  invalidatePartnerBranding(partnerId);
}

/** Байты логотипа для публичной раздачи. Тёмного нет — отдаём светлый. */
export async function readPartnerLogo(
  partnerId: string,
  variant: LogoVariant,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const row = await db.partnerBranding.findUnique({
    where: { partnerId },
    select: { logoLight: true, logoLightMime: true, logoDark: true, logoDarkMime: true, partner: { select: { status: true } } },
  });
  if (!row || row.partner.status !== "active") return null;
  const pick =
    variant === "dark" && row.logoDark && row.logoDarkMime
      ? { bytes: row.logoDark, mime: row.logoDarkMime }
      : row.logoLight && row.logoLightMime
        ? { bytes: row.logoLight, mime: row.logoLightMime }
        : null;
  if (!pick) return null;
  return { bytes: new Uint8Array(pick.bytes), mime: pick.mime };
}
