/**
 * Когда предлагать поставить приложение на домашний экран.
 *
 * На iPhone установка — не украшение, а условие работы сразу четырёх
 * вещей: уведомлений, цифры на иконке, долгой жизни офлайн-очереди и
 * сохранённых фотографий. Safari чистит хранилище сайта после семи дней
 * без визитов, а у установленного приложения — не чистит. То есть
 * запись, сделанная в подвале без связи, у обычной вкладки может просто
 * исчезнуть.
 *
 * И ровно поэтому предложение нельзя показывать в лоб на первом же
 * заходе: человек, который ещё ничего не сделал, закроет его не глядя,
 * а второго шанса не будет — отказ мы обязаны помнить. Показываем после
 * того, как он уже дважды успешно записал, то есть когда польза
 * очевидна ему самому.
 */

export type InstallPromptInput = {
  /** iOS (включая iPad, притворяющийся макбуком). */
  isIos: boolean;
  /** Уже запущено с домашнего экрана — предлагать нечего. */
  isStandalone: boolean;
  /** Сколько записей человек успешно сохранил на этом устройстве. */
  entriesSaved: number;
  /** Когда отказался в прошлый раз, мс эпохи; `null` — не отказывался. */
  dismissedAt: number | null;
  now: number;
};

/** Показываем после второй записи: к этому моменту польза очевидна. */
export const INSTALL_PROMPT_AFTER_ENTRIES = 2;

/** Отказ помним месяц — повторять чаще значит выпрашивать. */
export const INSTALL_PROMPT_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldShowInstallPrompt(input: InstallPromptInput): boolean {
  if (input.isStandalone) return false;
  // Пока предложение адресное: на iOS у него есть цена бездействия.
  // На Android установка тоже полезна, но там ничего не ломается без неё.
  if (!input.isIos) return false;
  if (input.entriesSaved < INSTALL_PROMPT_AFTER_ENTRIES) return false;
  if (input.dismissedAt === null) return true;
  // Часы на телефоне переводят; отказ «из будущего» считаем свежим,
  // иначе перевод даты назад превращает его в бесконечный показ.
  if (input.dismissedAt > input.now) return false;
  return input.now - input.dismissedAt >= INSTALL_PROMPT_SNOOZE_MS;
}

const ENTRIES_KEY = "wesetup.mini.entries-saved";
const DISMISSED_KEY = "wesetup.mini.install-dismissed-at";

/** Счётчик записей. Всё в try/catch: в приватной вкладке хранилище кидает. */
export function readEntriesSaved(): number {
  try {
    const raw = window.localStorage.getItem(ENTRIES_KEY);
    const value = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function noteEntrySaved(): void {
  try {
    window.localStorage.setItem(ENTRIES_KEY, String(readEntriesSaved() + 1));
  } catch {
    /* хранилище заблокировано — предложение просто не появится */
  }
}

export function readInstallDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const value = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function noteInstallDismissed(now: number = Date.now()): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(now));
  } catch {
    /* ignore */
  }
}
