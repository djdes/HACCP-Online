/**
 * G1 — In-memory кеш для часто-запрашиваемых данных дашборда.
 * Не Redis — пока WeSetup один-PM2 inst.
 *
 * Использование:
 *   const data = await dashboardCache.getOrCompute(
 *     `health:${orgId}`,
 *     30, // TTL seconds
 *     () => runOrgHealthCheck(orgId)
 *   );
 *
 * Cache invalidates автоматически по TTL. Дополнительно можно
 * `dashboardCache.invalidate(prefix)` после write-операций.
 */

type Entry<T> = {
  value: T;
  expiresAt: number;
};

class Cache {
  private store = new Map<string, Entry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.size > 1000) {
      // Простая очистка — убираем устаревшие чтобы не разрастаться.
      const now = Date.now();
      for (const [k, e] of this.store) {
        if (e.expiresAt < now) this.store.delete(k);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getOrCompute<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  invalidate(prefix: string): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  size(): number {
    return this.store.size;
  }
}

export const dashboardCache = new Cache();
