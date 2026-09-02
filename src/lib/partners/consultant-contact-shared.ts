/**
 * Клиентски-безопасная часть контактов консультанта: тип для передачи в
 * компоненты и helpers для ссылок. Без импорта БД — этот модуль тянут
 * client-компоненты (меню поддержки, настройки консультанта).
 */
export type ConsultantContact = {
  brandName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  accentColor: string | null;
  accentHover: string | null;
  phone: string | null;
  telegram: string | null;
  email: string | null;
};

/** `@name` / `t.me/name` / `https://t.me/name` → ссылка на Telegram. */
export function telegramHref(raw: string): string {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^(t\.me\/|@)/i, "");
  return `https://t.me/${handle}`;
}

/** Телефон в `tel:` — оставляем только цифры и ведущий плюс. */
export function phoneHref(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}
