import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatOutSum, verifySuccessSignature } from "@/lib/robokassa";
import { hashInviteToken } from "@/lib/invite-tokens";

export const dynamic = "force-dynamic";

/**
 * Статус заказа для страницы /order: пользователь возвращается с оплаты
 * раньше, чем приходит серверное уведомление, поэтому клиент поллит этот
 * endpoint, пока заказ не станет `paid`.
 *
 * Отдаём данные только тому, кто доказал право их видеть:
 *   • валидной success-подписью (Пароль #1) из редиректа Робокассы, либо
 *   • одноразовым токеном достройки профиля.
 * Иначе перебором InvId можно было бы узнать, кто и на сколько платил.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const completeToken = url.searchParams.get("complete");

  const order = completeToken
    ? await db.paymentOrder.findUnique({
        where: { completeTokenHash: hashInviteToken(completeToken) },
      })
    : await findBySignature(url);

  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const tokenAlive =
    order.completeTokenHash !== null &&
    order.completeTokenExpiresAt !== null &&
    order.completeTokenExpiresAt.getTime() > Date.now() &&
    order.status !== "completed";

  return NextResponse.json({
    invId: order.id,
    status: order.status,
    email: order.email,
    amountRub: Number(order.amountRub),
    description: order.description,
    isTest: order.isTest,
    // Новому клиенту показываем форму достройки профиля; существующему —
    // просто «подписка продлена, войдите».
    needsCompletion: order.status === "paid" && tokenAlive,
  });
}

async function findBySignature(url: URL) {
  const outSum = url.searchParams.get("OutSum") ?? "";
  const invIdRaw = url.searchParams.get("InvId") ?? "";
  const signature = url.searchParams.get("SignatureValue") ?? "";
  const invId = Number(invIdRaw);

  if (!outSum || !signature || !Number.isInteger(invId) || invId <= 0) {
    return null;
  }

  const order = await db.paymentOrder.findUnique({ where: { id: invId } });
  if (!order) return null;
  if (formatOutSum(outSum) !== formatOutSum(order.amountRub.toString())) {
    return null;
  }
  const ok = verifySuccessSignature({
    outSum,
    invId: invIdRaw,
    signature,
    isTest: order.isTest,
  });
  return ok ? order : null;
}
