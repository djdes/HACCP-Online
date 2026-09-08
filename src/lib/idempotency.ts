/**
 * Идемпотентность записи журнала.
 *
 * Зачем: `DynamicForm` отправляет запись через `retryFetch`, который
 * повторяет попытку, когда промис `fetch` отклонён. А отклоняется он и
 * тогда, когда сервер запрос УЖЕ принял и обрабатывает — радио отвалилось
 * на обратном пути. Повтор без защиты пишет вторую запись о температуре,
 * измеренной один раз. На проверке две одинаковые записи с разницей в
 * секунду читаются не как «дубль», а как подделка журнала.
 *
 * Поэтому «сначала застолбить, потом делать»:
 *
 *   1. пробуем ВСТАВИТЬ строку с ключом — она же и есть блокировка;
 *   2. вставка не прошла (ключ занят):
 *      • работа уже завершена → отдаём тот же ответ, что и в первый раз;
 *      • ещё выполняется → отвечаем «повторите позже», НЕ дублируя;
 *   3. работа сделана → дописываем в строку ответ;
 *   4. работа упала → снимаем бронь, чтобы человек мог отправить снова.
 *
 * Проверки «поищем, потом создадим» здесь недостаточно: одновременность —
 * не редкий случай, а обычный. Первая попытка ещё выполняется на сервере
 * ровно в тот момент, когда приходит вторая.
 *
 * Хранилище — таблица `JournalExternalIdempotency`: она уже есть и по
 * форме подходит (`key` — первичный ключ, ответ и статус рядом). Ключи
 * разведены префиксами, чтобы внешний API и кабинет не пересеклись.
 */

/** Статус, которым помечена ещё не завершённая работа. */
export const IN_FLIGHT_STATUS = 0;

/** Ответ, сохранённый после первой успешной обработки. */
export type StoredResponse = {
  httpStatus: number;
  response: unknown;
};

/**
 * Узкий срез Prisma — чтобы логику можно было проверить тестом без БД.
 * `create` ОБЯЗАН бросать при занятом ключе (у `key` первичный ключ).
 */
export type IdempotencyStore = {
  create(row: {
    key: string;
    organizationId: string | null;
    journalCode: string | null;
    httpStatus: number;
    response: unknown;
  }): Promise<unknown>;
  find(key: string): Promise<StoredResponse | null>;
  complete(key: string, value: StoredResponse): Promise<unknown>;
  release(key: string): Promise<unknown>;
};

export type ClaimResult =
  /** Ключ наш, работу выполняем. */
  | { kind: "proceed" }
  /** Работа уже была выполнена — отдаём прежний ответ. */
  | { kind: "replay"; stored: StoredResponse }
  /** Тот же ключ прямо сейчас обрабатывается другим запросом. */
  | { kind: "in_flight" };

/**
 * Ключ клиента приводим к каноничному виду и привязываем к пользователю:
 * ключ одного человека не должен пересечься с ключом другого, даже если
 * оба сгенерировали одинаковую строку.
 */
export function journalIdempotencyKey(
  userId: string,
  clientKey: string,
): string | null {
  const trimmed = clientKey.trim().slice(0, 120);
  // Слишком короткий ключ означает угадываемый: чужой запрос можно было
  // бы «занять» и получить в ответ его результат.
  if (trimmed.length < 8) return null;
  return `journal:${userId}:${trimmed}`;
}

/**
 * Ключ для одной отправки формы. Генерируется на клиенте один раз и
 * переиспользуется всеми повторами `retryFetch` — в этом весь смысл.
 *
 * `crypto.randomUUID` есть не везде (по http вне localhost его нет
 * вовсе), поэтому фолбэк на случайные байты, а при их отсутствии — на
 * время плюс Math.random. Ключ не секрет, от него нужна только
 * несовпадаемость.
 */
export function newIdempotencyKey(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export async function claimIdempotency(
  store: IdempotencyStore,
  args: {
    key: string;
    organizationId: string | null;
    journalCode: string | null;
  },
): Promise<ClaimResult> {
  try {
    await store.create({
      key: args.key,
      organizationId: args.organizationId,
      journalCode: args.journalCode,
      httpStatus: IN_FLIGHT_STATUS,
      response: {},
    });
    return { kind: "proceed" };
  } catch {
    // Единственная ожидаемая причина — ключ занят. Любую другую ошибку
    // тоже разбираем чтением: если строки нет, значит упало хранилище,
    // и тогда честнее пропустить запись, чем потерять её.
    const stored = await store.find(args.key).catch(() => null);
    if (!stored) return { kind: "proceed" };
    if (stored.httpStatus === IN_FLIGHT_STATUS) return { kind: "in_flight" };
    return { kind: "replay", stored };
  }
}

/**
 * Хранилище поверх Prisma. Отдельно от чистой логики выше, чтобы та
 * проверялась тестом без базы.
 */
export function prismaIdempotencyStore(client: {
  journalExternalIdempotency: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findUnique(args: {
      where: { key: string };
      select: { httpStatus: true; response: true };
    }): Promise<{ httpStatus: number; response: unknown } | null>;
    update(args: {
      where: { key: string };
      data: Record<string, unknown>;
    }): Promise<unknown>;
    delete(args: { where: { key: string } }): Promise<unknown>;
  };
}): IdempotencyStore {
  const table = client.journalExternalIdempotency;
  return {
    create: (row) =>
      table.create({
        data: {
          key: row.key,
          organizationId: row.organizationId,
          journalCode: row.journalCode,
          httpStatus: row.httpStatus,
          response: row.response as never,
        },
      }),
    find: async (key) => {
      const row = await table.findUnique({
        where: { key },
        select: { httpStatus: true, response: true },
      });
      return row ? { httpStatus: row.httpStatus, response: row.response } : null;
    },
    complete: (key, value) =>
      table.update({
        where: { key },
        data: {
          httpStatus: value.httpStatus,
          response: value.response as never,
          // Отсчёт хранения — от завершения: пока запрос выполняется,
          // уборщик не должен унести бронь из-под него.
          createdAt: new Date(),
        },
      }),
    // Бронь снимаем, только если она ещё наша (не успела завершиться).
    release: (key) => table.delete({ where: { key } }).catch(() => null),
  };
}
