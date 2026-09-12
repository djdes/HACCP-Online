/**
 * Мгновенная перерисовка списка задач до ответа сервера.
 *
 * «Завершить» сейчас стоит двух обращений к сети подряд: сначала само
 * действие, потом перечитывание списка. На кухонном 3G это пара секунд
 * спиннера на действии, результат которого известен заранее.
 *
 * Чистой функцией — из-за `myActive`. Пока он не снят, все «Взять» в
 * других журналах остаются заблокированными подсказкой «сначала
 * заверши». Забыть снять его значит запереть человека в журнале,
 * который он только что закрыл, и понять причину он не сможет.
 */

export type PoolScopeLike = {
  scopeKey: string;
  availability: "available" | "mine" | "taken" | "completed";
  claim: { id: string; status: string } | null;
};

export type PoolLike<S extends PoolScopeLike> = {
  scopes: S[];
  myActive: { id: string } | null;
};

/** Задача закрыта: остаётся в списке отметкой «готово». */
export function applyCompleted<S extends PoolScopeLike, P extends PoolLike<S>>(
  pool: P,
  claimId: string
): P {
  return {
    ...pool,
    scopes: pool.scopes.map((scope) =>
      scope.claim?.id === claimId
        ? // Расширение с подменой полей типом не выводится как `S`, хотя
          // им и остаётся: поля те же, меняются только значения.
          ({
            ...scope,
            availability: "completed",
            claim: { ...scope.claim, status: "completed" },
          } as S)
        : scope
    ),
    myActive: pool.myActive?.id === claimId ? null : pool.myActive,
  };
}

/** Задача отпущена: снова свободна для любого. */
export function applyReleased<S extends PoolScopeLike, P extends PoolLike<S>>(
  pool: P,
  claimId: string
): P {
  return {
    ...pool,
    scopes: pool.scopes.map((scope) =>
      scope.claim?.id === claimId
        ? ({ ...scope, availability: "available", claim: null } as S)
        : scope
    ),
    myActive: pool.myActive?.id === claimId ? null : pool.myActive,
  };
}
