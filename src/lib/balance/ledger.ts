import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import { transactionKindLabel, type BalanceTransactionKind } from "./constants";

/**
 * Леджер баллов.
 *
 * Инварианты, ради которых существует этот модуль:
 *   • `Organization.balanceRub` никогда не уходит в минус — списание идёт
 *     условным `updateMany` с проверкой остатка, и два параллельных
 *     запроса не могут пройти оба;
 *   • сумма строк `BalanceTransaction` всегда равна `balanceRub` —
 *     изменение баланса и вставка строки живут в одной транзакции;
 *   • повторный вызов с тем же `dedupeKey` — no-op, а не второе
 *     начисление (P2002 гасим, как в partners/accruals.ts).
 */

export class InsufficientBalanceError extends Error {
  constructor(message = "Недостаточно баллов на балансе") {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

export type BalanceChangeInput = {
  organizationId: string;
  /** + начисление, − списание. Ноль отбрасывается как no-op. */
  amount: number;
  kind: BalanceTransactionKind;
  description: string;
  dedupeKey?: string | null;
  paymentOrderId?: number | null;
  referredOrganizationId?: string | null;
  customerReviewId?: string | null;
  actorUserId?: string | null;
};

type TxClient = Prisma.TransactionClient;

/**
 * Изменение баланса вместе со строкой леджера.
 *
 * Вызывается ВНУТРИ `db.$transaction` — вызывающий сам решает, что ещё
 * должно попасть в ту же транзакцию (создание заказа, одобрение отзыва).
 * Возвращает `false`, если строка с таким `dedupeKey` уже была.
 */
export async function applyBalanceChange(
  tx: TxClient,
  input: BalanceChangeInput,
): Promise<boolean> {
  const amount = Math.trunc(input.amount);
  if (amount === 0) return false;

  if (amount < 0) {
    // Условие `gte` — единственная защита от гонки: два параллельных
    // списания увидят один и тот же баланс, но второй updateMany вернёт
    // count = 0, потому что остатка уже не хватает.
    const claimed = await tx.organization.updateMany({
      where: { id: input.organizationId, balanceRub: { gte: -amount } },
      data: { balanceRub: { decrement: -amount } },
    });
    if (claimed.count === 0) throw new InsufficientBalanceError();
  } else {
    const updated = await tx.organization.updateMany({
      where: { id: input.organizationId },
      data: { balanceRub: { increment: amount } },
    });
    if (updated.count === 0) {
      throw new Error(`Организация ${input.organizationId} не найдена`);
    }
  }

  try {
    await tx.balanceTransaction.create({
      data: {
        organizationId: input.organizationId,
        amount,
        kind: input.kind,
        description: input.description.slice(0, 500),
        dedupeKey: input.dedupeKey ?? null,
        paymentOrderId: input.paymentOrderId ?? null,
        referredOrganizationId: input.referredOrganizationId ?? null,
        customerReviewId: input.customerReviewId ?? null,
        actorUserId: input.actorUserId ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Дубль по dedupeKey. Откатываем всю транзакцию — иначе баланс
      // уехал бы без строки в леджере.
      throw new DuplicateBalanceChangeError();
    }
    throw error;
  }
  return true;
}

/** Сигнал «эту операцию уже проводили» — вызывающий гасит его как no-op. */
export class DuplicateBalanceChangeError extends Error {
  constructor() {
    super("Операция уже была проведена");
    this.name = "DuplicateBalanceChangeError";
  }
}

/**
 * Самостоятельное начисление/списание одной транзакцией. Возвращает
 * `false`, если операция с таким `dedupeKey` уже проводилась.
 */
export async function creditBalance(input: BalanceChangeInput): Promise<boolean> {
  try {
    return await db.$transaction((tx) => applyBalanceChange(tx, input));
  } catch (error) {
    if (error instanceof DuplicateBalanceChangeError) return false;
    throw error;
  }
}

export async function getBalance(organizationId: string): Promise<number> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { balanceRub: true },
  });
  return org?.balanceRub ?? 0;
}

export type BalanceTransactionView = {
  id: string;
  amount: number;
  kind: string;
  kindLabel: string;
  description: string;
  createdAt: string;
  paymentOrderId: number | null;
};

export async function listTransactions(
  organizationId: string,
  options?: { take?: number; actorUserId?: string },
): Promise<BalanceTransactionView[]> {
  const rows = await db.balanceTransaction.findMany({
    where: {
      organizationId,
      ...(options?.actorUserId ? { actorUserId: options.actorUserId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.take ?? 100,
  });
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    kind: row.kind,
    kindLabel: transactionKindLabel(row.kind),
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    paymentOrderId: row.paymentOrderId,
  }));
}
