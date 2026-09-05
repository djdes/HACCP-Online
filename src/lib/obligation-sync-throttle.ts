/**
 * Точки/скорость (2026-09-05): сверка обязательств на GET главной Mini App.
 *
 * Полная сверка (все сотрудники × все журналы × точки) — самая дорогая
 * часть `/api/mini/home`: экран открывался 2–3 секунды. Ждём её только
 * пока за сегодня нет ни одной строки (первое открытие дня должно сразу
 * показать задачи), дальше обновляем в фоне и не чаще раза в минуту на
 * ключ. Процесс один (PM2), поэтому карта в памяти достаточна; после
 * рестарта первый запрос просто снова ждёт сверку.
 */
const lastRunAt = new Map<string, number>();

export function utcDayKey(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function scheduleObligationSync(
  key: string,
  run: () => Promise<unknown>,
  options: { force: boolean; minIntervalMs?: number },
): Promise<"awaited" | "background" | "skipped"> {
  const now = Date.now();
  const minInterval = options.minIntervalMs ?? 60_000;
  const last = lastRunAt.get(key) ?? 0;
  if (options.force) {
    lastRunAt.set(key, now);
    await run();
    return "awaited";
  }
  if (now - last < minInterval) return "skipped";
  lastRunAt.set(key, now);
  void run().catch((error) => {
    console.error(`[obligation-sync] background sync failed for ${key}:`, error);
  });
  return "background";
}

/** Для тестов: сбросить память троттлинга. */
export function resetObligationSyncThrottle(): void {
  lastRunAt.clear();
}
