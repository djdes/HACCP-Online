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
} from "@/components/journals/queued-photos";

import { decideQueueOutcome, retryDelayMs } from "./queue-policy";

export { QUEUED_PHOTO_PREFIX } from "./queued-photo-mark";

const DB_NAME = "wesetup-mini";
const DB_VERSION = 1;
const STORE = "journal-queue";

export type QueuedJournalEntry = {
  /** Он же ключ идемпотентности — один на все попытки этой записи. */
  id: string;
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
};

/**
 * Пробует отправить всё, чему подошёл срок. Вызывается при появлении
 * связи и при открытии кабинета.
 */
export async function flushJournalQueue(): Promise<FlushResult> {
  if (!isQueueAvailable()) return { sent: 0, rejected: 0, pending: 0 };

  const entries = await listQueuedEntries();
  let sent = 0;
  let rejected = 0;

  for (const entry of entries) {
    if (entry.nextAttemptAt > Date.now()) continue;

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
      if (error instanceof PhotoRejectedError) {
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
  return { sent, rejected, pending: left.length };
}
