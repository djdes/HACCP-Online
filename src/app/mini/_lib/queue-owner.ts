/**
 * Кому можно отправить запись из офлайн-очереди.
 *
 * Вынесено чистой функцией и под тест намеренно — по той же причине, по
 * которой под тестом лежит распознавание свайпа: здесь решается, чьей
 * подписью будет подписан журнал, а журнал — доказательство на проверке.
 *
 * Беда, от которой это защищает, тихая и правдоподобная. На кухне «одна
 * трубка на три смены»: повар А заполнил журнал без связи, смену сдал,
 * повар Б вошёл на том же телефоне, появилась сеть — и запись А ушла с
 * сессией Б. В журнале остаётся подпись человека, который измерения не
 * делал, и время, когда он ещё не был на смене.
 */

export type QueueOwnerDecision =
  /** Автор совпал — отправляем. */
  | { kind: "send" }
  /** Запись чужая — ждёт своего человека. Это не ошибка и не повтор. */
  | { kind: "wait_owner" }
  /** Автор неизвестен: запись из очереди старее поля `ownerUserId`. */
  | { kind: "wait_unknown_owner" }
  /** В приложении никого нет — отправлять не от кого. */
  | { kind: "no_session" };

export function decideQueueOwner(
  entryOwnerUserId: string | null | undefined,
  currentUserId: string | null | undefined
): QueueOwnerDecision {
  if (!currentUserId) return { kind: "no_session" };
  // Пустая строка — тоже «неизвестно»: пустой идентификатор не должен
  // случайно совпасть с чем-либо.
  if (!entryOwnerUserId) return { kind: "wait_unknown_owner" };
  return entryOwnerUserId === currentUserId
    ? { kind: "send" }
    : { kind: "wait_owner" };
}

/** Короткая форма для фильтров. */
export function canSendQueuedEntry(
  entryOwnerUserId: string | null | undefined,
  currentUserId: string | null | undefined
): boolean {
  return decideQueueOwner(entryOwnerUserId, currentUserId).kind === "send";
}
