import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "@/lib/invite-tokens";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";
import { describeHardwareConfig } from "@/lib/hardware-pricing";
import { formatRub } from "@/lib/tariffs";
import { defaultJournalAutomationJson } from "@/lib/journal-automation";

/**
 * Что происходит после подтверждённой оплаты.
 *
 * Вынесено из вебхука, потому что вебхук обязан ответить Робокассе
 * `OK{InvId}` быстро и ровно один раз: сначала атомарно помечаем заказ
 * оплаченным, потом уже спокойно заводим организацию и рассылаем
 * уведомления.
 *
 * Два сценария:
 *   • почта неизвестна → заводим Organization + User (как при обычной
 *     регистрации) и выдаём одноразовый токен, по которому клиент
 *     дозаполнит профиль и задаст пароль;
 *   • почта известна → просто продлеваем подписку существующей
 *     организации, ничего не создавая.
 */

export type FulfillmentResult = {
  organizationId: string;
  userId: string;
  /// Сырой токен достройки профиля. Null, если клиент уже существовал —
  /// ему достраивать нечего, он входит своим паролем.
  completeToken: string | null;
  isNewClient: boolean;
  subscriptionEnd: Date;
};

const APP_URL = (
  process.env.NEXTAUTH_URL ||
  process.env.APP_URL ||
  "https://wesetup.ru"
).replace(/\/+$/, "");

/**
 * Продлевает подписку от большей из дат «сейчас» и «текущий конец»:
 * оплата за месяц вперёд не должна сгорать, если клиент заплатил
 * до истечения предыдущего периода.
 */
function extendFrom(current: Date | null, periodDays: number): Date {
  const base =
    current && current.getTime() > Date.now() ? current.getTime() : Date.now();
  return new Date(base + periodDays * 24 * 60 * 60 * 1000);
}

export async function fulfillPaidOrder(order: {
  id: number;
  email: string;
  tariffKey: string;
  description: string;
  bundleConfig: unknown;
  amountRub: unknown;
}): Promise<FulfillmentResult> {
  const periodDays = await readPeriodDays(order.tariffKey);
  const existing = await db.user.findUnique({
    where: { email: order.email },
    select: { id: true, organizationId: true },
  });

  if (existing) {
    const org = await db.organization.findUnique({
      where: { id: existing.organizationId },
      select: { subscriptionEnd: true },
    });
    const subscriptionEnd = extendFrom(org?.subscriptionEnd ?? null, periodDays);
    await db.organization.update({
      where: { id: existing.organizationId },
      data: { subscriptionPlan: "paid", subscriptionEnd },
    });
    await db.paymentOrder.update({
      where: { id: order.id },
      data: {
        organizationId: existing.organizationId,
        userId: existing.id,
      },
    });
    return {
      organizationId: existing.organizationId,
      userId: existing.id,
      completeToken: null,
      isNewClient: false,
      subscriptionEnd,
    };
  }

  // Новый клиент. Пароль ставим случайный: настоящий он задаст сам на
  // экране достройки профиля по одноразовому токену. Пустой хэш класть
  // нельзя — иначе аккаунт остался бы с невалидируемым паролем.
  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(24).toString("base64url"),
    12,
  );
  const subscriptionEnd = extendFrom(null, periodDays);
  const rawToken = generateInviteToken();

  const created = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: `Организация ${order.email}`,
        type: "other",
        subscriptionPlan: "paid",
        subscriptionEnd,
        // Автоматика гигиенического журнала — сразу после оплаты.
        journalAutomationJson: defaultJournalAutomationJson(),
      },
    });
    const user = await tx.user.create({
      data: {
        email: order.email,
        name: order.email,
        passwordHash,
        role: "manager",
        organizationId: organization.id,
        journalAccessMigrated: true,
      },
    });
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        organizationId: organization.id,
        userId: user.id,
        completeTokenHash: hashInviteToken(rawToken),
        completeTokenExpiresAt: inviteExpiresAt(),
      },
    });
    return { organization, user };
  });

  return {
    organizationId: created.organization.id,
    userId: created.user.id,
    completeToken: rawToken,
    isNewClient: true,
    subscriptionEnd,
  };
}

async function readPeriodDays(tariffKey: string): Promise<number> {
  const tariff = await db.platformTariff.findUnique({
    where: { key: tariffKey },
    select: { periodDays: true },
  });
  return tariff?.periodDays ?? 30;
}

/**
 * Письмо клиенту и уведомление владельцу. Обе рассылки best-effort:
 * упавшая почта или недоступный Telegram не должны ломать вебхук —
 * деньги уже получены, доступ уже выдан.
 */
export async function notifyAboutPayment(args: {
  order: {
    id: number;
    email: string;
    description: string;
    amountRub: unknown;
    bundleConfig: unknown;
    isTest: boolean;
  };
  result: FulfillmentResult;
}): Promise<void> {
  const { order, result } = args;
  const amount = Number(order.amountRub);
  const completeUrl = result.completeToken
    ? `${APP_URL}/order?complete=${result.completeToken}`
    : `${APP_URL}/login`;

  await sendPaymentReceiptEmail({
    to: order.email,
    amountRub: amount,
    description: order.description,
    actionUrl: completeUrl,
    isNewClient: result.isNewClient,
    subscriptionEnd: result.subscriptionEnd,
  }).catch((err) => console.error("sendPaymentReceiptEmail failed", err));

  const chatId = (process.env.PLATFORM_ADMIN_TELEGRAM_CHAT_ID ?? "").trim();
  if (!chatId) return;

  const hardware = describeHardwareConfig(
    (order.bundleConfig as Record<string, number>) ?? {},
  );
  const lines = [
    order.isTest ? "🧪 ТЕСТОВЫЙ платёж" : "💰 Оплата получена",
    `Сумма: ${formatRub(amount)}`,
    `Тариф: ${order.description}`,
    `Почта: ${order.email}`,
    result.isNewClient
      ? "Новый клиент — организация создана автоматически"
      : "Существующий клиент — подписка продлена",
    `Подписка до: ${result.subscriptionEnd.toLocaleDateString("ru-RU")}`,
    `Заказ №${order.id}`,
  ];
  if (hardware.length > 0) {
    lines.push("", "Оборудование к отгрузке:", ...hardware.map((h) => `• ${h}`));
  }

  await sendTelegramMessage(chatId, lines.join("\n")).catch((err) =>
    console.error("payment telegram notify failed", err),
  );
}
