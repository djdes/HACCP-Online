/**
 * В каком состоянии находятся push-уведомления на этом устройстве.
 *
 * Чистая функция и отдельный тест, потому что состояний пять, и три из
 * них требуют от человека РАЗНЫХ действий. Свалить их в одну кнопку
 * «включить» значит отправить половину людей нажимать то, что у них не
 * сработает.
 *
 * Отдельная боль — iOS. Там Safari разрешает push только после того, как
 * приложение добавлено на экран «Домой»: в обычной вкладке `Notification`
 * либо отсутствует, либо запрос разрешения молча ничего не делает. Пока
 * не добавлено, человеку надо объяснить именно это, а не показывать
 * кнопку, которая не работает.
 */

export type PushEnvironment = {
  /** Есть ли Service Worker и PushManager. */
  supported: boolean;
  /** Текущее разрешение браузера. */
  permission: NotificationPermission | null;
  /** Устройство на iOS/iPadOS. */
  isIos: boolean;
  /** Приложение запущено с домашнего экрана, а не как вкладка. */
  isStandalone: boolean;
  /** Подписка на этом устройстве уже есть. */
  subscribed: boolean;
};

export type PushState =
  /** Браузер не умеет — показывать нечего. */
  | { kind: "unsupported" }
  /** iOS без установки: сперва «Поделиться» → «На экран Домой». */
  | { kind: "needs_install" }
  /** Разрешение отклонено, и повторно спросить браузер не даст. */
  | { kind: "blocked" }
  /** Всё готово, можно предлагать включить. */
  | { kind: "can_enable" }
  /** Работает; можно отключить. */
  | { kind: "enabled" };

export function pushState(env: PushEnvironment): PushState {
  if (!env.supported) return { kind: "unsupported" };

  // Порядок важен: на iOS во вкладке `permission` бывает "default", и
  // без этой проверки мы предложили бы кнопку, которая ничего не
  // сделает, а человек решил бы, что приложение сломано.
  if (env.isIos && !env.isStandalone) return { kind: "needs_install" };

  // "denied" необратимо из кода: повторный запрос браузер отклоняет
  // молча. Единственный выход — настройки сайта, о чём и говорим.
  if (env.permission === "denied") return { kind: "blocked" };

  if (env.permission === "granted" && env.subscribed) return { kind: "enabled" };

  return { kind: "can_enable" };
}

/** Читает окружение из браузера. Вызывать только на клиенте. */
export function readPushEnvironment(subscribed: boolean): PushEnvironment {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const win = typeof window !== "undefined" ? window : null;

  const supported = Boolean(
    nav && "serviceWorker" in nav && win && "PushManager" in win,
  );

  const ua = nav?.userAgent ?? "";
  // iPadOS с 13-й версии представляется как Mac, отличается наличием
  // тач-точек — иначе на планшете кухни мы дали бы неверную подсказку.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);

  const isStandalone = Boolean(
    win?.matchMedia?.("(display-mode: standalone)")?.matches ||
      (nav as unknown as { standalone?: boolean })?.standalone === true,
  );

  return {
    supported,
    permission:
      typeof Notification !== "undefined" ? Notification.permission : null,
    isIos,
    isStandalone,
    subscribed,
  };
}

/**
 * Публичный ключ VAPID приходит строкой base64url, а `subscribe` требует
 * Uint8Array. Без этого преобразования подписка падает с невнятным
 * `InvalidCharacterError`.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  // Буфер создаём явно: `applicationServerKey` требует именно
  // ArrayBuffer, а безымянный Uint8Array типизируется как
  // ArrayBufferLike и может оказаться SharedArrayBuffer.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
