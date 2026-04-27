/**
 * Простой in-memory rate-limit. Для production-нагрузок (несколько
 * нод) нужен Redis, но пока WeSetup — single-PM2-процесс, in-memory
 * хватает.
 *
 * Использование:
 *   const rl = createRateLimiter({ tokensPerInterval: 10, intervalMs: 60_000 });
 *   if (!rl.consume(key)) → 429
 *
 * Счётчики автоматически очищаются — каждые `intervalMs * 2` ms старые
 * ключи удаляются (sweep при доступе).
 */

type Bucket = {
  tokens: number;
  resetAt: number;
};

export type RateLimiter = {
  /** Возвращает true если запрос разрешён, иначе false. */
  consume(key: string): boolean;
  /** Сколько секунд до сброса счётчика. */
  remainingMs(key: string): number;
};

export function createRateLimiter(opts: {
  tokensPerInterval: number;
  intervalMs: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();

  function sweep(now: number) {
    // Дёшево — пробежать раз в N запросов и удалить устаревшие.
    if (buckets.size < 1000) return;
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }

  return {
    consume(key: string): boolean {
      const now = Date.now();
      sweep(now);
      let b = buckets.get(key);
      if (!b || b.resetAt < now) {
        b = { tokens: opts.tokensPerInterval, resetAt: now + opts.intervalMs };
        buckets.set(key, b);
      }
      if (b.tokens <= 0) return false;
      b.tokens -= 1;
      return true;
    },
    remainingMs(key: string): number {
      const b = buckets.get(key);
      if (!b) return 0;
      return Math.max(0, b.resetAt - Date.now());
    },
  };
}

/** Singletons для основных endpoints. Создаются раз на инстанс. */
export const aiChatRateLimiter = createRateLimiter({
  tokensPerInterval: 10,
  intervalMs: 60_000,
});

export const aiHeavyRateLimiter = createRateLimiter({
  tokensPerInterval: 5,
  intervalMs: 60_000,
});

export const loginRateLimiter = createRateLimiter({
  // 5 попыток за 5 минут на IP — защита от brute-force.
  tokensPerInterval: 5,
  intervalMs: 5 * 60 * 1000,
});
