/**
 * Простой parallel-runner с bounded concurrency. Без deps.
 *
 * Использование:
 *   const results = await runWithConcurrency(items, 5, async (item) => {
 *     return await someAsyncOp(item);
 *   });
 *
 * Сохраняет порядок входа в результирующий массив. Если одна из
 * операций бросает — остальные продолжают (errors попадают в
 * результат как rejected promise через мини-обёртку), всю партию
 * не отменяем (caller сам решит как обрабатывать ошибки).
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const cap = Math.max(1, Math.floor(concurrency));
  const results: Array<
    { ok: true; value: R } | { ok: false; error: unknown }
  > = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        const value = await fn(items[idx], idx);
        results[idx] = { ok: true, value };
      } catch (error) {
        results[idx] = { ok: false, error };
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(cap, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
