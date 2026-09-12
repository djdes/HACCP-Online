"use client";

/**
 * Очередь отправки записей журнала, переживающая закрытие вкладки.
 *
 * Почему IndexedDB, а не localStorage: там лежат фотографии, а
 * localStorage хранит только строки. Держать снимок кухни в base64 —
 * это +33% к весу и упор в квоту в 5 МБ с третьего фото.
 *
 * В очередь кладём ТОЛЬКО отправку записи журнала. Ни взятие задачи, ни
 * начало смены, ни передача смены сюда не попадают, и это не упущение:
 * отложенное взятие задачи крадёт её у того, кто взял по-настоящему, а
 * смена, начатая задним числом, — это ложь в документе.
 *
 * Дублей не бывает потому, что ключ идемпотентности (`id` записи) един
 * для всех попыток: сервер по нему отдаёт прежний ответ вместо второй
 * записи. Очередь без этой защиты писала бы вторую запись о температуре,
 * измеренной один раз, — на проверке это читается как подделка журнала.
 */

import {
  PhotoRejectedError,
  uploadAndSubstitutePhotos,
  MissingQueuedPhotoError,
} from "@/components/journals/queued-photos";

import { decideQueueOutcome, retryDelayMs } from "./queue-policy";
import { canSendQueuedEntry } from "./queue-owner";

export { QUEUED_PHOTO_PREFIX } from "./queued-photo-mark";

const DB_NAME = "wesetup-mini";
/**
 * v2 — появилось поле `ownerUserId`. Записи, созданные до обновления,
 * его не имеют; что с ними делать, описано у `flushJournalQueue`.
 */
const DB_VERSION = 2;
const STORE = "journal-queue";

export type QueuedJournalEntry = {
  /** Он же ключ идемпотентности — один на все попытки этой записи. */
  id: string;
  /**
   * Кто заполнил. Без этого поля запись уходила с той сессией, которая
   * окажется активной в момент появления связи, — а на кухне «одна
   * трубка на три смены»: повар А заполняет без связи, смену сдаёт,
   * повар Б входит, и запись А уходит за подписью Б. В журнале —
   * подпись под измерением, которого человек не делал.
   *
   * `null` — запись из очереди старее этого поля (версия базы 1).
   * Такие не отправляются автоматически: угадывать автора доказательства
   * нельзя.
   */
  ownerUserId: string | null;
  createdAt: number;
  /** Название журнала — чтобы человеку было что показать в списке. */
  journalName: string;
  /** Тело POST /api/journals как есть. */
  payload: Record<string, unknown>;
  /** Снимки, которые не успели загрузиться, по метке из payload. */
  photos: Record<string, Blob>;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // Приватный режим и «блокировать данные сайтов» дают отказ прямо
    // здесь. Очередь тогда просто не работает — форма ведёт себя как
    // раньше, без офлайна.
    request.onblocked = () => reject(new Error("indexeddb blocked"));
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export function isQueueAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function enqueueJournalEntry(
  entry: Omit<QueuedJournalEntry, "attempts" | "nextAttemptAt" | "lastError">,
): Promise<void> {
  await tx("readwrite", (store) =>
    store.put({
      ...entry,
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: null,
    } satisfies QueuedJournalEntry),
  );
}

export async function listQueuedEntries(): Promise<QueuedJournalEntry[]> {
  const rows = await tx<QueuedJournalEntry[]>("readonly", (store) =>
    store.getAll() as IDBRequest<QueuedJournalEntry[]>,
  ).catch(() => [] as QueuedJournalEntry[]);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueuedEntry(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id)).catch(() => {});
}

/**
 * Записи без автора — те, что легли в очередь до появления поля.
 * Отправить их «от текущего» нельзя, выбросить тоже: это чья-то работа.
 * Поэтому они ждут человека, который подтвердит, что они его.
 */
export async function listOrphanQueuedEntries(): Promise<QueuedJournalEntry[]> {
  const rows = await listQueuedEntries();
  return rows.filter((entry) => !entry.ownerUserId);
}

/**
 * Человек подтвердил, что запись его. Только после этого она может уйти.
 * Спрашиваем явно и с показом содержимого — подпись в журнале ставится
 * один раз, и переставить её потом нельзя.
 */
export async function claimQueuedEntry(
  id: string,
  userId: string,
): Promise<void> {
  const rows = await listQueuedEntries();
  const entry = rows.find((row) => row.id === id);
  if (!entry || entry.ownerUserId) return;
  await tx("readwrite", (store) =>
    store.put({ ...entry, ownerUserId: userId, nextAttemptAt: Date.now() }),
  ).catch(() => {});
}

/**
 * «Повторить сейчас» — сбрасывает выдержку до следующей попытки.
 * Счётчик попыток не трогаем: он объясняет, почему выдержка выросла.
 */
export async function retryQueuedEntry(id: string): Promise<void> {
  const rows = await listQueuedEntries();
  const entry = rows.find((row) => row.id === id);
  if (!entry) return;
  await tx("readwrite", (store) =>
    store.put({ ...entry, nextAttemptAt: Date.now(), lastError: null }),
  ).catch(() => {});
}

const A_DAY_MS = 24 * 60 * 60 * 1000;

async function markAttempt(
  entry: QueuedJournalEntry,
  error: string | null,
  /** Повторять нечего — откладываем надолго, чтобы не молотить впустую. */
  hopeless = false,
): Promise<void> {
  const attempts = entry.attempts + 1;
  await tx("readwrite", (store) =>
    store.put({
      ...entry,
      attempts,
      nextAttemptAt:
        Date.now() + (hopeless ? A_DAY_MS : retryDelayMs(attempts)),
      lastError: error,
    } satisfies QueuedJournalEntry),
  ).catch(() => {});
}

export type FlushResult = {
  sent: number;
  rejected: number;
  pending: number;
  /** Записи чужого автора или без автора — ждут, а не отправляются. */
  foreign: number;
};

/**
 * Пробует отправить всё, чему подошёл срок. Вызывается при появлении
 * связи и при открытии кабинета.
 */
export async function flushJournalQueue(
  /**
   * Кто сейчас в приложении. Отправляем только его записи: запрос уходит
   * с текущей кукой, и чужая запись получила бы чужую подпись.
   * `null` (сессии нет) — не отправляем ничего.
   */
  currentUserId: string | null,
): Promise<FlushResult> {
  if (!isQueueAvailable()) return { sent: 0, rejected: 0, pending: 0, foreign: 0 };
  if (!currentUserId) {
    const all = await listQueuedEntries();
    return { sent: 0, rejected: 0, pending: all.length, foreign: 0 };
  }

  const entries = await listQueuedEntries();
  let sent = 0;
  let rejected = 0;
  let foreign = 0;

  for (const entry of entries) {
    if (entry.nextAttemptAt > Date.now()) continue;
    // Чужая запись и запись без автора ждут своего человека. Ни то ни
    // другое не ошибка и не повод для повтора — поэтому и счётчик
    // попыток не трогаем: он про связь, а не про то, кто держит телефон.
    // Правило в `queue-owner.ts` и под тестом: здесь решается, чьей
    // подписью будет подписан журнал.
    if (!canSendQueuedEntry(entry.ownerUserId, currentUserId)) {
      foreign++;
      continue;
    }

    try {
      // Снимки уходят ПЕРЕД записью: запись со ссылкой на файл,
      // которого нет, хуже, чем ещё одна попытка позже.
      const payload = await uploadAndSubstitutePhotos(
        entry.payload,
        entry.photos ?? {},
      );
      const response = await fetch("/api/journals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Тот же ключ, что и у первой попытки, — в этом вся защита
          // от второй записи.
          "Idempotency-Key": entry.id,
        },
        body: JSON.stringify(payload),
      });

      const decision = decideQueueOutcome({
        kind: "http",
        status: response.status,
      });
      if (decision.kind === "done") {
        await removeQueuedEntry(entry.id);
        sent++;
      } else if (decision.kind === "rejected") {
        // Не удаляем: человек считает запись сделанной, и молчаливая
        // пропажа хуже, чем строка «не принято» у него на экране.
        rejected++;
        await markAttempt(entry, `Сервер не принял запись (${response.status})`);
      } else {
        await markAttempt(entry, null);
      }
    } catch (error) {
      if (error instanceof MissingQueuedPhotoError) {
        // Снимка больше нет — связь его не вернёт. Повторять такую
        // запись бессмысленно, а отправить нельзя: в журнал уйдёт
        // строка вместо доказательства. Оставляем видимой в «Что не ушло».
        rejected++;
        await markAttempt(entry, "Фото потеряно — запишите заново со снимком", true);
      } else if (error instanceof PhotoRejectedError) {
        // Сервер снимок не принял (например, слишком большой). Повторять
        // бессмысленно — отказ тот же. Запись оставляем и помечаем: она
        // видна в счётчике, и молчаливой пропажи не будет.
        rejected++;
        await markAttempt(entry, "Сервер не принял фото", true);
      } else {
        await markAttempt(entry, null);
      }
    }
  }

  const left = await listQueuedEntries();
  return { sent, rejected, pending: left.length, foreign };
}

/**
 * Записи текущего человека — для счётчика на экране.
 *
 * Считать всё подряд нельзя: повар увидел бы «ждёт отправки: 3», где
 * все три принадлежат сменщику, и решил бы, что его работа не ушла.
 */
export async function listOwnQueuedEntries(
  currentUserId: string | null,
): Promise<QueuedJournalEntry[]> {
  if (!currentUserId) return [];
  const rows = await listQueuedEntries();
  return rows.filter((entry) => canSendQueuedEntry(entry.ownerUserId, currentUserId));
}
