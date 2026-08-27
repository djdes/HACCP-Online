/**
 * Единая точка «уведомить админа платформы».
 *
 * До этого модуля служебные события расползались по двум разным env:
 * регистрации и оплаты уходили в `PLATFORM_ADMIN_TELEGRAM_CHAT_ID`, а
 * обратная связь — в `FEEDBACK_ADMIN_TG_CHAT_ID`, то есть двум разным
 * людям, и владелец не понимал, кто что видит. Здесь один источник
 * правды, legacy-переменные остаются fallback'ом, чтобы ничего не
 * отвалилось до чистки прод-окружения.
 */

import { sendTelegramMessage } from "@/lib/telegram";

/** Разбор списка chat id: «111, 222» → ["111", "222"] (дубликаты убираем). */
export function parseChatIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return Array.from(new Set(ids));
}

/**
 * Chat id(ы) админа платформы.
 *
 * `PLATFORM_ADMIN_TELEGRAM_CHAT_ID` — источник правды, можно перечислить
 * несколько через запятую (владелец + помощник). `FEEDBACK_ADMIN_TG_CHAT_ID`
 * добавляется следом как legacy: пока прод-env не почищен, обращения должны
 * продолжать приходить туда, куда приходили.
 */
export function getPlatformAdminChatIds(): string[] {
  const primary = parseChatIdList(process.env.PLATFORM_ADMIN_TELEGRAM_CHAT_ID);
  const legacy = parseChatIdList(process.env.FEEDBACK_ADMIN_TG_CHAT_ID);
  return Array.from(new Set([...primary, ...legacy]));
}

/** Почта админа платформы. `PLATFORM_ADMIN_EMAIL` новее, `FEEDBACK_ADMIN_EMAIL` — legacy. */
export function getPlatformAdminEmail(): string | null {
  const primary = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  if (primary) return primary;
  const legacy = process.env.FEEDBACK_ADMIN_EMAIL?.trim();
  return legacy || null;
}

/**
 * Маскированное значение для показа в админке: «…638». Владелец не должен
 * гадать, чей chat id настроен, но и целиком светить его в UI незачем.
 */
export function maskChatId(chatId: string): string {
  return chatId.length <= 4 ? chatId : `…${chatId.slice(-4)}`;
}

/** Маска почты для той же цели: «yor…@gmail.com». */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, Math.min(3, local.length));
  return `${head}…${domain}`;
}

/**
 * Шлёт текст во все админ-чаты через `sendTelegramMessage` — там уже есть
 * TelegramLog и retry на 429, поэтому свой транспорт не изобретаем.
 *
 * `kind` попадает в `TelegramLog.kind` как `admin:<kind>` — по логу видно,
 * какие именно служебные уведомления реально ушли.
 *
 * Возвращает true, если хотя бы одна отправка успешна: вызывающий код
 * (форма обратной связи, бот) записывает по этому флагу `adminTgNotifiedAt`.
 */
export async function notifyPlatformAdmin(
  text: string,
  opts?: { kind?: string }
): Promise<boolean> {
  const chatIds = getPlatformAdminChatIds();
  if (chatIds.length === 0) {
    console.error(
      "[platform-admin] чат админа не настроен: PLATFORM_ADMIN_TELEGRAM_CHAT_ID пуст"
    );
    return false;
  }

  const kind = opts?.kind ? `admin:${opts.kind}` : "admin";
  const results = await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        return await sendTelegramMessage(chatId, text, { delivery: { kind } });
      } catch (error) {
        console.error("[platform-admin] telegram send failed:", error);
        return false;
      }
    })
  );

  return results.some(Boolean);
}
