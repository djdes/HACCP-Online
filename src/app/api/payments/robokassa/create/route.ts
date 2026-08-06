import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readTariff, TARIFF_BUNDLE } from "@/lib/tariffs";
import {
  hardwareTotal,
  normalizeHardwareConfig,
} from "@/lib/hardware-pricing";
import {
  buildPaymentParams,
  buildPaymentUrl,
  isConfigured,
  isTestMode,
  sendReceipt,
  type ReceiptItem,
} from "@/lib/robokassa";
import { createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Создание заказа на оплату. Публичный endpoint — вызывается со страницы
 * /order до какой-либо авторизации (клиента ещё нет, он появится после
 * оплаты), поэтому здесь только почта и ключ тарифа.
 *
 * Сумма считается ТОЛЬКО на сервере: с клиента приходит состав корзины
 * (`{ deviceId: qty }`), а рубли берутся из БД-тарифа и прайса железа.
 * Иначе можно было бы прислать «оплачу за 1 ₽».
 */

const createOrderRateLimiter = createRateLimiter({
  // 10 заказов за 10 минут на IP: живому человеку хватит на несколько
  // попыток и смену тарифа, скрипту — нет.
  tokensPerInterval: 10,
  intervalMs: 10 * 60 * 1000,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Приём оплаты пока не настроен. Напишите на support@wesetup.ru" },
      { status: 503 },
    );
  }

  if (!createOrderRateLimiter.consume(clientIp(request))) {
    return NextResponse.json(
      { error: "Слишком много попыток. Попробуйте через несколько минут" },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const tariffKey = typeof body.tariffKey === "string" ? body.tariffKey : "";

  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json(
      { error: "Укажите корректный адрес электронной почты" },
      { status: 400 },
    );
  }

  const tariff = await readTariff(tariffKey);
  if (!tariff) {
    return NextResponse.json(
      { error: "Тариф недоступен" },
      { status: 400 },
    );
  }

  const bundleConfig =
    tariff.key === TARIFF_BUNDLE
      ? normalizeHardwareConfig(body.bundleConfig)
      : null;
  const amountRub =
    tariff.priceRub + (bundleConfig ? hardwareTotal(bundleConfig) : 0);

  if (amountRub <= 0) {
    return NextResponse.json(
      { error: "Сумма заказа получилась нулевой — выберите оборудование" },
      { status: 400 },
    );
  }

  const description = bundleConfig
    ? `${tariff.title} (подписка на ${tariff.periodDays} дн. + оборудование)`
    : `${tariff.title} на ${tariff.periodDays} дн.`;

  const order = await db.paymentOrder.create({
    data: {
      email,
      tariffKey: tariff.key,
      amountRub,
      description,
      bundleConfig: bundleConfig ?? undefined,
      isTest: isTestMode(),
    },
    select: { id: true, amountRub: true, isTest: true },
  });

  const receiptItems: ReceiptItem[] | undefined = sendReceipt()
    ? [
        {
          name: description.slice(0, 128),
          quantity: 1,
          sum: amountRub,
          payment_method: "full_payment",
          payment_object: "service",
          tax: "none",
        },
      ]
    : undefined;

  const params = buildPaymentParams({
    id: order.id,
    amountRub,
    description,
    email,
    isTest: order.isTest,
    receiptItems,
  });

  return NextResponse.json({
    invId: order.id,
    amountRub,
    description,
    params,
    // Фолбэк на обычную форму оплаты, если iframe-скрипт не загрузился.
    paymentUrl: buildPaymentUrl(params),
  });
}
