import { db } from "@/lib/db";
import { notifyPlatformAdmin } from "@/lib/platform-admin";

/**
 * Алерты админу платформы о сбоях фоновых процессов.
 *
 * Сейчас фоновые падения уходят в `console.error`, и узнать о них можно
 * только зайдя в логи PM2. Молчат ровно те вещи, из-за которых сервис
 * перестаёт работать незаметно: залипший outbox TasksFlow (задачи не
 * доходят до исполнителей), отвалившийся polling (статусы задач не
 * синхронизируются), упавшая ночная автоматика (журналы за день не
 * созданы).
 *
 * Главное требование к этому модулю — НЕ стать шумом. Алерт должен
 * означать «нужно вмешаться руками», иначе его перестанут читать, и
 * тогда он бесполезен ровно в тот день, когда действительно сломается.
 * Отсюда два ограничителя:
 *
 *  1. **Кулдаун** — не чаще раза в час на один повод. Считается по
 *     `TelegramLog` (kind + dedupeKey), своей таблицы не заводим: лог
 *     отправок и так единственный источник правды о том, что ушло.
 *  2. **Серия провалов** — для задач, которые штатно ретраятся, алерт
 *     шлётся со второго подряд провала. Разовая сетевая ошибка чинится
 *     следующим запуском и человека будить не должна. Счёт хранит
 *     `CronRunState`.
 */

export type PlatformAlertKind =
  | "tasksflow-outbox"
  | "tasksflow-poll"
  | "journal-automation";

/** Не чаще раза в час на один повод. */
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Статусы прошлой отправки, при которых повторять не нужно. `failed` в
 * список НЕ входит: если алерт не долетел, следующий запуск обязан
 * попробовать снова, иначе поломка так и останется незамеченной.
 */
const DELIVERED_STATUSES = ["queued", "sent", "rate_limited"];

export type RaiseAlertResult = "sent" | "throttled" | "not-delivered";

/**
 * Шлёт алерт админу, если такой же не уходил в последний час.
 *
 * `dedupeKey` различает поводы внутри одного типа: «очередь распухла» и
 * «очередь стоит» — разные новости, и глушить одну другой неправильно.
 */
export async function raisePlatformAlert(args: {
  kind: PlatformAlertKind;
  dedupeKey: string;
  text: string;
  now?: Date;
}): Promise<RaiseAlertResult> {
  const now = args.now ?? new Date();
  const logKind = `admin:${args.kind}`;

  const recent = await db.telegramLog.findFirst({
    where: {
      kind: logKind,
      dedupeKey: args.dedupeKey,
      status: { in: DELIVERED_STATUSES },
      createdAt: { gte: new Date(now.getTime() - ALERT_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent) return "throttled";

  const ok = await notifyPlatformAdmin(args.text, {
    kind: args.kind,
    dedupeKey: args.dedupeKey,
  });
  return ok ? "sent" : "not-delivered";
}

/**
 * Записывает исход запуска задачи и возвращает длину серии провалов.
 *
 * Успех обнуляет счёт — иначе одна давняя поломка навсегда оставила бы
 * задачу «в серии» и следующий одиночный сбой сразу дал бы алерт.
 */
export async function recordCronRun(args: {
  job: string;
  ok: boolean;
  error?: string | null;
}): Promise<number> {
  if (args.ok) {
    await db.cronRunState.upsert({
      where: { job: args.job },
      create: { job: args.job, failStreak: 0, lastError: null },
      update: { failStreak: 0, lastError: null },
    });
    return 0;
  }

  const error = args.error?.slice(0, 500) ?? null;
  const row = await db.cronRunState.upsert({
    where: { job: args.job },
    create: { job: args.job, failStreak: 1, lastError: error },
    update: { failStreak: { increment: 1 }, lastError: error },
  });
  return row.failStreak;
}

/** Со скольки подряд провалов будим человека. */
export const FAIL_STREAK_ALERT_THRESHOLD = 2;

/** Очередь считается залипшей, если pending-записей больше этого числа. */
export const OUTBOX_PENDING_ALERT_THRESHOLD = 20;

/** …или если старейшая pending-запись висит дольше этого срока. */
export const OUTBOX_STALE_MS = 30 * 60 * 1000;

/**
 * Проверяет очередь команд в TasksFlow и будит админа, если она встала.
 *
 * Два независимых повода: очередь распухла (значит отправка не
 * успевает) и очередь стоит (значит отправка вообще не идёт). Второй
 * важнее: двадцать записей могут быть штатным всплеском, а вот запись,
 * висящая полчаса, означает, что задачи до сотрудников не доходят.
 */
export async function checkTasksflowOutboxHealth(now: Date = new Date()) {
  const [pendingCount, oldest] = await Promise.all([
    db.tasksFlowOutbox.count({ where: { status: "pending" } }),
    db.tasksFlowOutbox.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const stuckMs = oldest ? now.getTime() - oldest.createdAt.getTime() : 0;
  const isStale = stuckMs > OUTBOX_STALE_MS;
  const isPiling = pendingCount > OUTBOX_PENDING_ALERT_THRESHOLD;
  if (!isStale && !isPiling) return null;

  const minutes = Math.round(stuckMs / 60000);
  const reason = isStale ? "stale" : "piling";
  const text = isStale
    ? `<b>TasksFlow: очередь встала</b>\nСтарейшая команда висит ${minutes} мин, всего в очереди ${pendingCount}.\nЗадачи до исполнителей не доходят — проверьте доступность TasksFlow API.`
    : `<b>TasksFlow: очередь растёт</b>\nВ очереди ${pendingCount} команд, отправка не успевает.`;

  const result = await raisePlatformAlert({
    kind: "tasksflow-outbox",
    dedupeKey: reason,
    text,
    now,
  });
  return { reason, pendingCount, stuckMinutes: minutes, alert: result };
}
