import { logoUrlFor, type OrgBranding } from "./branding";
import type { ConsultantContact } from "./consultant-contact-shared";

export { phoneHref, telegramHref, type ConsultantContact } from "./consultant-contact-shared";

/**
 * Контакты консультанта для клиентских экранов (сериализуемо, без Date):
 * блок «Ваш консультант» на дашборде, в помощи и в футере. Собирается на
 * сервере из `getVisibleOrgBranding` и уходит в клиентские компоненты.
 * Тип и helpers ссылок — в `consultant-contact-shared.ts` (без БД).
 */
export function toConsultantContact(branding: OrgBranding | null): ConsultantContact | null {
  if (!branding) return null;
  return {
    brandName: branding.brandName,
    logoUrl: branding.hasLogoLight ? logoUrlFor(branding, "light") : null,
    logoDarkUrl: branding.hasLogoDark ? logoUrlFor(branding, "dark") : null,
    accentColor: branding.accentColor,
    accentHover: branding.accentHover,
    phone: branding.supportPhone,
    telegram: branding.supportTelegram,
    email: branding.supportEmail,
  };
}
