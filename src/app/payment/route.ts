import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatOutSum, verifyResultSignature } from "@/lib/robokassa";
import {
  fulfillPaidOrder,
  notifyAboutPayment,
} from "@/lib/payment-fulfillment";

export const dynamic = "force-dynamic";

/**
 * ResultURL Робокассы.
 *
 * Адрес зафиксирован в кабинете магазина как `https://wesetup.ru/payment/`,
 * поэтому вебхук живёт здесь, а не в /api/* — URL-схему кабинета менять
 * не стали.
 *
 * Контракт Робокассы: в ответ строго `OK{InvId}` текстом. Любой другой
 * ответ считается неуспехом, и уведомление будет повторяться, поэтому на
 * уже обработанный заказ отвечаем тем же `OK` вместо ошибки.
 *
 * Endpoint публичный по своей природе. Защита: подпись Пароля #2, сверка
 * суммы с сохранённым заказом и атомарный переход pending → paid.
 */

function ok(invId: string): NextResponse {
  return new NextResponse(`OK${invId}`, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function bad(message: string): NextResponse {
  // Робокасса ретраит всё, что не OK; для битой подписи это и нужно —
  // пусть в кабинете останется след неуспешного уведомления.
  return new NextResponse(message, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("bad request");
  }

  const raw: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") raw[key] = value;
  }

  const outSum = raw.OutSum ?? raw.outSum ?? "";
  const invIdRaw = raw.InvId ?? raw.invId ?? "";
  const signature = raw.SignatureValue ?? raw.signatureValue ?? "";
  const invId = Number(invIdRaw);

  if (!outSum || !signature || !Number.isInteger(invId) || invId <= 0) {
    return bad("bad request");
  }

  const order = await db.paymentOrder.findUnique({ where: { id: invId } });
  if (!order) return bad("unknown order");

  // Сумма сверяется с сохранённой в заказе, а не берётся из уведомления,
  // иначе подменённый OutSum «оплатил» бы подписку на любую сумму.
  if (formatOutSum(outSum) !== formatOutSum(order.amountRub.toString())) {
    console.error(
      `robokassa: amount mismatch on order ${invId}: got ${outSum}, expected ${order.amountRub}`,
    );
    return bad("amount mismatch");
  }

  const signatureOk = verifyResultSignature({
    outSum,
    invId: invIdRaw,
    signature,
    isTest: order.isTest,
    receipt: raw.Receipt ?? null,
  });
  if (!signatureOk) {
    console.error(`robokassa: bad signature on order ${invId}`);
    return bad("bad signature");
  }

  // Идемпотентность: перевести в paid может только один запрос. Повторное
  // уведомление получит count = 0 и просто подтвердится.
  const claimed = await db.paymentOrder.updateMany({
    where: { id: invId, status: "pending" },
    data: { status: "paid", paidAt: new Date(), rawResult: raw },
  });
  if (claimed.count === 0) return ok(invIdRaw);

  try {
    const result = await fulfillPaidOrder(order);
    await notifyAboutPayment({ order, result });
  } catch (error) {
    // Деньги получены и заказ уже помечен оплаченным — откатывать статус
    // нельзя, иначе повторное уведомление создаст вторую организацию.
    // Логируем и подтверждаем: разбор руками через /root по номеру заказа.
    console.error(`robokassa: fulfillment failed for order ${invId}`, error);
  }

  return ok(invIdRaw);
}

/**
 * Живой GET нужен, чтобы случайный переход по адресу из кабинета или
 * закладки не отдавал 405 — уводим человека на страницу заказа.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/order", request.url));
}
