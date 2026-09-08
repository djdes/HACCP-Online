import { NextResponse } from "next/server";

import { checkCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { runMercuryOutbox } from "@/lib/mercury/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Собственная константа advisory-lock: 9523847 занят
 * `/api/cron/tasksflow-outbox`, и переиспользование заблокировало бы две
 * независимые очереди друг о друга.
 */
const ADVISORY_LOCK_KEY = 9523851;

/**
 * GET /api/cron/mercury-outbox?secret=$CRON_SECRET
 *
 * Проигрывает очередь заявок Ветис.API — и команды (гашение), и чтения
 * (списки ВСД). Протокол двухфазный, поэтому один тик может как
 * отправить заявку, так и забрать результат ранее отправленной: строка
 * очереди живёт `pending → submitted → delivered|failed`.
 *
 * Расписание: раз в минуту. Крон ВНЕШНИЙ (crontab на сервере или
 * cron-job.org) — в репозитории 33 таких роута и ни одного встроенного
 * планировщика, новый роут сам себя не пропишет:
 *
 *   * * * * * curl -s "https://wesetup.ru/api/cron/mercury-outbox?secret=$CRON_SECRET" >/dev/null
 *
 * Вся политика решений (что повторить, что признать доставленным, когда
 * проверять статус ВСД перед повтором) живёт в
 * `src/lib/mercury/outbox-policy.ts` и покрыта юнит-тестами — в отличие
 * от аналогичного крона TasksFlow, где она зашита в обработчик.
 */
export async function GET(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;

  const started = Date.now();

  // Тики не должны наезжать друг на друга: заявка отправляется и
  // опрашивается разными тиками, и параллельный прогон мог бы отправить
  // команду гашения дважды.
  const [{ locked }] = await db.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked
  `;
  if (!locked) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      skipped: "another_tick_running",
    });
  }

  try {
    const result = await runMercuryOutbox({ limit: 50 });
    return NextResponse.json({ ok: true, ...result, ms: Date.now() - started });
  } catch (error) {
    console.error("[mercury-outbox]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  } finally {
    await db.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  }
}
