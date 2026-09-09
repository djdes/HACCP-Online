/**
 * Живые события: сервер сообщает вкладке, что что-то изменилось.
 *
 * Зачем: колокольчик опрашивал сервер раз в минуту, чат — раз в 25
 * секунд, баланс не обновлялся вовсе. Админ начислял баллы, а человек
 * узнавал об этом, только сам открыв «Баланс». Сервис должен ощущаться
 * живым: начислили — сразу видно, ответили — сразу пришло.
 *
 * Механизм — Server-Sent Events. Одно долгоживущее соединение на
 * вкладку, сервер пишет в него события. Почему не WebSocket: он
 * требует отдельного сервера или кастомного запуска Next, а нам нужна
 * только доставка сервер → клиент. `EventSource` есть во всех
 * браузерах и сам переподключается.
 *
 * ГЛАВНОЕ ПРАВИЛО: событие — это сигнал «перечитай», а не данные.
 * Клиент, получив событие, запрашивает состояние обычным API. Так
 * источник правды остаётся один (база), а потерянное во время
 * переподключения событие не страшно: при `open` клиент перечитывает
 * всё заново. Деплой перезапускает процесс и рвёт все соединения —
 * именно поэтому нельзя было опираться на содержимое событий.
 *
 * Шина — в памяти ОДНОГО процесса. PM2 запускает приложение в режиме
 * fork, воркер один, так что этого достаточно. Если когда-нибудь
 * появится cluster, шину придётся заменить на Postgres NOTIFY или
 * Redis — интерфейс ниже это позволяет, не трогая вызывающих.
 */

export type LiveEventType =
  | "notification"
  | "balance"
  | "journal"
  | "support"
  | "reconnect";

export type LiveEvent = {
  type: LiveEventType;
  /**
   * Уточнение: для `notification` — kind уведомления («support.reply»),
   * для `journal` — «changed», для `support` — «message» | «typing».
   */
  kind?: string;
  at: string;
  data?: Record<string, unknown>;
};

type Subscriber = {
  userId: string;
  organizationId: string | null;
  /** Отдать кадр в соединение. false — соединение уже мертво. */
  send: (frame: string) => boolean;
};

/**
 * Держим в `globalThis`: в dev модуль переисполняется при горячей
 * перезагрузке, и подписчики иначе терялись бы между версиями модуля.
 */
const KEY = Symbol.for("wesetup.live-events");
const registry: Set<Subscriber> =
  ((globalThis as Record<symbol, unknown>)[KEY] as Set<Subscriber>) ??
  (((globalThis as Record<symbol, unknown>)[KEY] = new Set<Subscriber>()) as Set<Subscriber>);

export function subscribe(subscriber: Subscriber): () => void {
  registry.add(subscriber);
  return () => {
    registry.delete(subscriber);
  };
}

export function subscriberCount(): number {
  return registry.size;
}

/** Кадр SSE: имя события и JSON одной строкой. */
export function formatSseEvent(event: LiveEvent): string {
  // JSON без переводов строк, иначе `data:` разъедется на несколько
  // строк и парсер браузера склеит их с «\n» — это допустимо, но
  // незачем.
  const json = JSON.stringify(event).replace(/\n/g, " ");
  return `event: ${event.type}\ndata: ${json}\n\n`;
}

/** Комментарий SSE — не доходит до обработчиков, держит соединение живым. */
export function formatSseComment(text: string): string {
  return `: ${text.replace(/\n/g, " ")}\n\n`;
}

function deliver(
  targets: Subscriber[],
  event: Omit<LiveEvent, "at">,
): number {
  const frame = formatSseEvent({ ...event, at: new Date().toISOString() });
  let delivered = 0;
  for (const subscriber of targets) {
    if (subscriber.send(frame)) {
      delivered += 1;
    } else {
      // Мёртвое соединение чистим на месте: иначе список рос бы до
      // перезапуска, а каждый publish гонял бы по трупам.
      registry.delete(subscriber);
    }
  }
  return delivered;
}

/** Всем вкладкам одного человека. */
export function publishToUser(
  userId: string,
  event: Omit<LiveEvent, "at">,
): number {
  return deliver(
    Array.from(registry).filter((s) => s.userId === userId),
    event,
  );
}

/**
 * Нескольким людям сразу — ROOT-пользователям, участникам партнёра.
 * Повторы id в списке не удваивают доставку.
 */
export function publishToUsers(
  userIds: Iterable<string>,
  event: Omit<LiveEvent, "at">,
): number {
  const ids = new Set(userIds);
  return deliver(
    Array.from(registry).filter((s) => ids.has(s.userId)),
    event,
  );
}

/** Всем, кто сейчас смотрит на эту организацию. */
export function publishToOrganization(
  organizationId: string,
  event: Omit<LiveEvent, "at">,
): number {
  return deliver(
    Array.from(registry).filter((s) => s.organizationId === organizationId),
    event,
  );
}
