/**
 * Offline cache & action queue for Mini App.
 *
 * - GET responses are cached in localStorage with a TTL.
 * - POST/PUT/DELETE actions are queued when offline and replayed later.
 */

const CACHE_PREFIX = "mini_cache_";
const QUEUE_KEY = "mini_offline_queue";
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CachedItem<T = unknown> = {
  data: T;
  cachedAt: number;
};

type QueuedAction = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  enqueuedAt: number;
};

function cacheKey(url: string): string {
  return CACHE_PREFIX + url;
}

export function getCached<T>(url: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const item: CachedItem<T> = JSON.parse(raw);
    if (Date.now() - item.cachedAt > DEFAULT_TTL_MS) {
      localStorage.removeItem(cacheKey(url));
      return null;
    }
    return item.data;
  } catch {
    return null;
  }
}

export function setCached<T>(url: string, data: T): void {
  try {
    const item: CachedItem<T> = { data, cachedAt: Date.now() };
    localStorage.setItem(cacheKey(url), JSON.stringify(item));
  } catch {
    // localStorage may be full — ignore
  }
}

export function getQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function setQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function enqueueAction(action: Omit<QueuedAction, "id" | "enqueuedAt">): void {
  const queue = getQueue();
  queue.push({
    ...action,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    enqueuedAt: Date.now(),
  });
  setQueue(queue);
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export async function syncQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body,
      });
      if (res.ok) {
        succeeded++;
      } else {
        failed++;
        remaining.push(action);
      }
    } catch {
      failed++;
      remaining.push(action);
    }
  }

  setQueue(remaining);
  return { succeeded, failed };
}

/**
 * Wrap fetch to use cache & queue automatically.
 */
export async function offlineFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const method = (options?.method ?? "GET").toUpperCase();

  if (method === "GET" && !isOnline) {
    const cached = getCached<unknown>(url);
    if (cached !== null) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Offline, no cache" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method !== "GET" && !isOnline) {
    const body = options?.body ? String(options.body) : null;
    enqueueAction({
      url,
      method,
      headers: (options?.headers as Record<string, string>) ?? {},
      body,
    });
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(url, options);
  if (method === "GET" && res.ok) {
    try {
      const clone = res.clone();
      const data = await clone.json();
      setCached(url, data);
    } catch {
      // not JSON — skip cache
    }
  }
  return res;
}
