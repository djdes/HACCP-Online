import { partnerPublicUrl } from "./service";

// Константы без зависимостей живут в validation.ts (клиентские компоненты
// импортируют их оттуда, не затягивая Prisma); здесь — для серверного кода.
export { INVITE_STATUS_LABELS, PARTNER_AGREEMENT_URL } from "./validation";

export type InviteTexts = {
  url: string;
  code: string;
  short: string;
  long: string;
  telegramShareUrl: string;
};

/** Готовые тексты приглашений — партнёр копирует или отправляет в Telegram. */
export function buildInviteTexts(brandName: string, slug: string, code: string): InviteTexts {
  const url = partnerPublicUrl(slug);
  const short = `${brandName} рекомендует WeSetup — электронные журналы СанПиН и ХАССП. Регистрация по ссылке: ${url} (или код ${code} в настройках).`;
  const long = [
    `Здравствуйте! Это ${brandName}.`,
    "",
    "Мы ведём санитарные журналы своих клиентов в WeSetup — электронные журналы СанПиН и ХАССП с автозаполнением и напоминаниями.",
    "",
    `Зарегистрируйтесь по нашей ссылке: ${url}`,
    `Если аккаунт уже есть — в Настройках → «Консультант» введите код ${code}.`,
    "",
    "После подключения мы будем видеть ваши журналы и помогать с проверками.",
  ].join("\n");
  return {
    url,
    code,
    short,
    long,
    telegramShareUrl: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(short)}`,
  };
}
