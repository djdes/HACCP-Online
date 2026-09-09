/**
 * Состояние соединения с потоком живых событий — чистая часть, без
 * браузера. Сам поток держит `use-live-events.ts`, индикатор в шапке —
 * `components/live/live-connection-indicator.tsx`.
 *
 * - `idle`   — поток не открыт (никто не подписан, или закрыли сами на pagehide);
 * - `open`   — соединение живое;
 * - `down`   — оборвалось, браузер в цикле переподключения;
 * - `closed` — сервер отказал (401 без сессии): браузер переподключаться
 *              не будет, и это не обрыв — индикатор молчит.
 */
export type LiveConnectionStatus = "idle" | "open" | "down" | "closed";

export type LiveConnectionState = {
  status: LiveConnectionStatus;
  /** Когда началось текущее «down»; сбрасывается при `open`. */
  downSince: number | null;
};

/**
 * Плашка «Нет связи с сервером» — только после минуты обрыва. Короткие
 * разрывы (деплой, перезапуск, смена сети) переживаются молча: браузер
 * переподключится через 3 с, и мигать из-за этого нечем.
 */
export const LIVE_DOWN_THRESHOLD_MS = 60_000;

export function shouldShowLiveDown(input: {
  status: LiveConnectionStatus;
  downSince: number | null;
  now: number;
  /** `navigator.onLine !== false` — офлайн показывает свой индикатор. */
  online: boolean;
  /** Скрытая вкладка: браузер сам придерживает переподключения. */
  visible: boolean;
  thresholdMs?: number;
}): boolean {
  if (input.status !== "down" || input.downSince == null) return false;
  if (!input.online || !input.visible) return false;
  return input.now - input.downSince >= (input.thresholdMs ?? LIVE_DOWN_THRESHOLD_MS);
}
