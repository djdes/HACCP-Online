/**
 * Политика очереди заявок Ветис — чистая функция.
 *
 * Вынесена из крона намеренно. В TasksFlow такая же логика зашита
 * прямо в обработчик (`src/app/api/cron/tasksflow-outbox/route.ts`), и
 * поэтому непроверяема юнит-тестами: чтобы посмотреть, что будет при
 * 5xx на девятнадцатой попытке, нужен живой Postgres и живой TasksFlow.
 * Здесь все ветки проверяются без БД и без сети.
 *
 * Ключевой инвариант — НЕ ГАСИТЬ ДВАЖДЫ. Заявки живут в Ветис трое
 * суток; если крон лежал дольше, результат потерян, а повторный
 * `ProcessIncomingConsignment` на их стороне не идемпотентен. Поэтому:
 *   • ошибка «ВСД уже погашен» = успех, а не провал;
 *   • протухшая заявка на КОМАНДУ не переотправляется вслепую — сначала
 *     проверяется фактический статус документа (`needsStatusCheck`).
 */
import { APPLICATION_RESULT_TTL_DAYS, isCommandOperation } from "./ns";
import { isAlreadyProcessedError, MercuryError } from "./errors";

export const MAX_ATTEMPTS = 20;
/** Сколько раз опрашиваем результат, прежде чем признать заявку зависшей. */
export const MAX_POLLS = 40;

export type OutboxRow = {
  action: string;
  status: "pending" | "submitted" | "delivered" | "failed";
  attempts: number;
  pollAttempts: number;
  applicationId: string | null;
  submittedAt: Date | null;
};

export type OutboxOutcome =
  | { kind: "submitted"; applicationId: string }
  | { kind: "inProcess" }
  | { kind: "completed"; resultXml: string }
  | { kind: "error"; error: unknown };

export type OutboxDecision =
  | { next: "submitted"; applicationId: string }
  | { next: "delivered"; reason?: string }
  | { next: "failed"; reason: string }
  /** Остаёмся в текущем статусе, попробуем на следующем тике. */
  | { next: "retry"; reason: string }
  /** Заявка протухла — отправляем заново. */
  | { next: "resubmit"; reason: string }
  /**
   * Команда протухла: переотправлять вслепую нельзя, сначала спросить
   * у Меркурия фактический статус ВСД.
   */
  | { next: "verify"; reason: string };

function isExpired(row: OutboxRow, now: Date): boolean {
  if (!row.submittedAt) return false;
  const ageDays =
    (now.getTime() - row.submittedAt.getTime()) / (24 * 60 * 60 * 1000);
  return ageDays > APPLICATION_RESULT_TTL_DAYS;
}

export function decideOutboxOutcome(
  row: OutboxRow,
  outcome: OutboxOutcome,
  now: Date = new Date(),
): OutboxDecision {
  switch (outcome.kind) {
    case "submitted":
      return { next: "submitted", applicationId: outcome.applicationId };

    case "completed":
      return { next: "delivered" };

    case "inProcess": {
      if (isExpired(row, now)) {
        return isCommandOperation(row.action)
          ? {
              next: "verify",
              reason: `Заявка старше ${APPLICATION_RESULT_TTL_DAYS} сут — проверяем статус ВСД перед повтором`,
            }
          : { next: "resubmit", reason: "Заявка протухла, отправляем заново" };
      }
      if (row.pollAttempts >= MAX_POLLS) {
        return {
          next: "failed",
          reason: `Меркурий не завершил заявку за ${MAX_POLLS} опросов`,
        };
      }
      return { next: "retry", reason: "Заявка ещё обрабатывается" };
    }

    case "error": {
      const { error } = outcome;

      // Главная ветка: повторное гашение — это успех прошлой попытки.
      if (isAlreadyProcessedError(error)) {
        return { next: "delivered", reason: "ВСД уже погашен" };
      }

      if (error instanceof MercuryError) {
        if (!error.retryable) {
          return {
            next: "failed",
            reason: error.message,
          };
        }
        if (row.attempts + 1 >= MAX_ATTEMPTS) {
          return {
            next: "failed",
            reason: `${error.message} (исчерпаны ${MAX_ATTEMPTS} попыток)`,
          };
        }
        return { next: "retry", reason: error.message };
      }

      // Неизвестная ошибка — не гадаем, помечаем провалом. Для команды
      // это безопаснее повтора: лучше показать менеджеру красное, чем
      // рискнуть вторым гашением.
      return {
        next: "failed",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Что делать после проверки фактического статуса ВСД (ветка `verify`).
 *
 * Если документ уже не `CONFIRMED`, значит наша команда дошла — заявку
 * закрываем как выполненную. Иначе можно спокойно отправлять заново.
 */
export function decideAfterStatusCheck(remoteStatus: string): OutboxDecision {
  if (remoteStatus === "CONFIRMED") {
    return { next: "resubmit", reason: "ВСД всё ещё не погашен — повторяем" };
  }
  return {
    next: "delivered",
    reason: `ВСД уже в статусе ${remoteStatus} — прошлая попытка дошла`,
  };
}
