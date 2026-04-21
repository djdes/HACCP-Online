/**
 * IndexedDB-backed submit queue для офлайн-заполнения журналов.
 *
 * Идея: на кухне интернет часто отваливается на минуту-две. Вместо
 * «форма не отправляется» кладём заявку в IndexedDB очередь, немедленно
 * помечаем строку «ждёт отправки», и как только `navigator.onLine`
 * или window 'online' event — автоматически отправляем в тот же
 * endpoint и убираем из очереди.
 *
 * Этот файл — client-only. Импортировать только из "use client"
 * компонентов / хуков.
 */

const DB_NAME = "wesetup-offline";
const DB_VERSION = 1;
const STORE = "submit-queue";

export type QueueItem = {
  id: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string | null;
  /** Человекочитаемая метка для UI, e.g. «Температура Морозильник #2 · 21.04» */
  label?: string;
  /** Группа (template code etc) — нужна чтобы можно было сказать «все записи cold_equipment_control сейчас на очереди». */
  group?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("group", "group", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    Promise.resolve(run(store)).then(resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function requestAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue(
  input: Omit<QueueItem, "id" | "createdAt" | "attempts">
): Promise<QueueItem> {
  const item: QueueItem = {
    id: newId(),
    createdAt: Date.now(),
    attempts: 0,
    ...input,
  };
  await withStore("readwrite", (store) => requestAsPromise(store.add(item)));
  dispatchChange();
  return item;
}

export async function listQueue(): Promise<QueueItem[]> {
  return withStore("readonly", async (store) => {
    const res = await requestAsPromise(store.getAll());
    return (res as QueueItem[]).sort((a, b) => a.createdAt - b.createdAt);
  });
}

export async function removeQueueItem(id: string): Promise<void> {
  await withStore("readwrite", (store) => requestAsPromise(store.delete(id)));
  dispatchChange();
}

export async function updateQueueItem(
  id: string,
  patch: Partial<QueueItem>
): Promise<void> {
  await withStore("readwrite", async (store) => {
    const existing = (await requestAsPromise(store.get(id))) as
      | QueueItem
      | undefined;
    if (!existing) return;
    await requestAsPromise(store.put({ ...existing, ...patch }));
  });
  dispatchChange();
}

export async function queueSize(): Promise<number> {
  return withStore("readonly", async (store) => {
    return (await requestAsPromise(store.count())) as number;
  });
}

/**
 * Пытается отправить все запросы из очереди. Возвращает сводку. Не
 * кидает ошибок на запрос — помечает attempts и lastError, оставляет
 * в очереди для следующей попытки.
 */
export async function flushQueue(): Promise<{
  flushed: number;
  failed: number;
  remaining: number;
}> {
  const items = await listQueue();
  let flushed = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers:
          item.body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
      });
      if (res.ok) {
        await removeQueueItem(item.id);
        flushed += 1;
      } else {
        const text = await res.text().catch(() => "");
        await updateQueueItem(item.id, {
          attempts: item.attempts + 1,
          lastError: `HTTP ${res.status}: ${text.slice(0, 120)}`,
        });
        failed += 1;
      }
    } catch (err) {
      // Обычно network error — интернет снова пропал. Оставляем в очереди.
      await updateQueueItem(item.id, {
        attempts: item.attempts + 1,
        lastError: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }
  const remaining = await queueSize();
  return { flushed, failed, remaining };
}

const CHANGE_EVENT = "wesetup-offline-queue-change";
function dispatchChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function subscribeQueueChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
