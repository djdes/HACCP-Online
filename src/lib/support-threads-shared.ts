/**
 * Клиентски-безопасная часть онлайн-чата: ключи веток, превью реплики и
 * решение «пора ли сигналить о новом сообщении». Без импорта БД — модуль
 * тянут виджеты, партнёрский кабинет и серверные роуты одновременно.
 */

export const ORG_KEY_PREFIX = "org:";
export const GUEST_KEY_PREFIX = "guest:";

export function orgThreadKey(organizationId: string): string {
  return `${ORG_KEY_PREFIX}${organizationId}`;
}

export type ThreadKind = "org" | "guest" | "legacy";

/** По ключу ветки понятно, чья она: организации, гостя или старая личная. */
export function threadKindOf(key: string): ThreadKind {
  if (key.startsWith(ORG_KEY_PREFIX)) return "org";
  if (key.startsWith(GUEST_KEY_PREFIX)) return "guest";
  return "legacy";
}

/** Короткое превью для всплывашки и списка веток. */
export function previewOf(
  body: string,
  attachmentsCount = 0,
  limit = 90
): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return attachmentsCount > 0 ? "📎 Вложение" : "";
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1)}…`;
}

export type SupportLatestMessage = {
  id: string;
  author: "client" | "operator";
  preview: string;
  operatorName: string | null;
  createdAt: string;
};

/** Ответ endpoint'ов `/status`: дёшево и достаточно для сигнала. */
export type SupportStatus = {
  threadId: string | null;
  unreadForClient: number;
  latest: SupportLatestMessage | null;
};

/**
 * Сигналить только о новой реплике оператора, которую клиент ещё не
 * прочитал и о которой ещё не сигналили на этом устройстве.
 */
export function shouldAlert(
  status: SupportStatus,
  lastAlertedId: string | null
): boolean {
  if (!status.latest || status.latest.author !== "operator") return false;
  if (status.unreadForClient <= 0) return false;
  return status.latest.id !== lastAlertedId;
}

/** «12 мин», «3 ч», «2 дн» — возраст сообщения для списков и пометок. */
export function ageLabel(from: Date | string, now: Date = new Date()): string {
  const fromMs = typeof from === "string" ? new Date(from).getTime() : from.getTime();
  const minutes = Math.max(0, Math.round((now.getTime() - fromMs) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} дн`;
}

/** Ветка ждёт ответа партнёра дольше суток — админу пора вмешаться. */
export const PARTNER_ESCALATION_HOURS = 24;
