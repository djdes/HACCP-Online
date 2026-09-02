import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "@/lib/invite-tokens";
import { sendPaymentReceiptEmail } from "@/lib/email";
import { notifyPlatformAdmin } from "@/lib/platform-admin";
import { describeHardwareConfig } from "@/lib/hardware-pricing";
import { formatRub } from "@/lib/tariffs";
import { defaultJournalAutomationJson } from "@/lib/journal-automation";
import { attachAccountForNewOrganization } from "@/lib/create-organization";

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
  /** Человек отметил согласие на автосписания при оплате. */
  recurringConsent?: boolean;
  /** Заполнено у автосписаний серии — родительский заказ. */
  recurringChargeOf?: number | null;
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
      data: {
        subscriptionPlan: "paid",
        subscriptionEnd,
        ...(order.recurringConsent
          ? { recurringActive: true, recurringParentOrderId: order.id }
          : {}),
        // Автопродление включает только платёж-РОДИТЕЛЬ серии: у него
        // касса и запоминает карту. Списание внутри серии (`chargeOf`)
        // ничего не переключает — иначе оно бы каждый месяц заново
        // «включало» то, что человек мог отключить.
        ...(order.recurringConsent && !order.recurringChargeOf
          ? {
              recurringActive: true,
              recurringParentOrderId: order.id,
              recurringDisabledAt: null,
              recurringFailedAttempts: 0,
            }
          : {}),
      },
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
    // Аккаунт — владелец тарифа и общего лимита мест (см.
    // lib/create-organization.ts). Оплаченная организация тем более
    // должна уметь расти во вторую точку.
    await attachAccountForNewOrganization(tx, {
      ownerUserId: user.id,
      organizationId: organization.id,
      subscriptionPlan: "paid",
      subscriptionEnd,
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
    organizationId: result.organizationId,
  }).catch((err) => console.error("sendPaymentReceiptEmail failed", err));

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

  // Оплаты идут в ту же единую точку, что регистрации и обращения.
  await notifyPlatformAdmin(lines.join("\n"), { kind: "payment" }).catch((err) =>
    console.error("payment telegram notify failed", err),
  );
}
