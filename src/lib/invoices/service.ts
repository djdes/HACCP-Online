import type { PaymentOrder, Prisma } from "@prisma/client";

import { buildBuyerSnapshot, buildSellerSnapshot } from "@/lib/closing-documents/build";
import { readLegalImage, readPlatformRequisites } from "@/lib/closing-documents/requisites";
import { db } from "@/lib/db";
import { sendInvoiceEmail } from "@/lib/email";
import type { LegalProfile } from "@/lib/org-legal-profile";
import { completePaidOrder } from "@/lib/payment-fulfillment";
import { notifyPlatformAdmin } from "@/lib/platform-admin";
import { isTestMode } from "@/lib/robokassa";
import { readTariff } from "@/lib/tariffs";

import { INVOICE_VALID_DAYS, buildInvoiceDraft, invoiceRequisitesReady } from "./build";
import { renderInvoicePdf } from "./pdf";

/**
 * Счёт по безналу — жизненный цикл.
 *
 * - `createInvoiceOrder`: заказ `paymentMethod = "invoice"` в статусе
 *   pending, без баллов и без кассы. Один действующий счёт на
 *   организацию: повторный запрос возвращает его же.
 * - `renderInvoice`: PDF по текущим реквизитам сторон (счёт — не
 *   закрывающий документ, снимок не нужен: оплатят — будет УПД).
 * - `markInvoicePaid` (ROOT): тот же путь, что у вебхука кассы —
 *   pending → paid одним updateMany, затем `completePaidOrder`: подписка,
 *   письмо, УПД, партнёрские начисления. Повторное нажатие — 409.
 * - `cancelInvoice` (ROOT): pending → cancelled.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export type CreateInvoiceResult =
  | { ok: true; order: PaymentOrder; created: boolean }
  | { ok: false; status: number; error: string };

function legalProfileOf(raw: unknown): LegalProfile | null {
  if (!raw || typeof raw !== "object") return null;
  return typeof (raw as Record<string, unknown>).inn === "string" ? (raw as LegalProfile) : null;
}

async function loadOrganizationParty(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, inn: true, address: true, legalProfileJson: true, subscriptionEnd: true },
  });
  if (!org) return null;
  return {
    name: org.name,
    inn: org.inn,
    address: org.address,
    legalProfile: legalProfileOf(org.legalProfileJson),
  };
}

export async function createInvoiceOrder(args: {
  organizationId: string;
  userId: string;
  email: string;
  tariffKey: string;
}): Promise<CreateInvoiceResult> {
  const requisites = await readPlatformRequisites();
  if (!invoiceRequisitesReady(requisites)) {
    return { ok: false, status: 409, error: "Оплата по счёту пока недоступна — реквизиты исполнителя не заполнены" };
  }
  const organization = await loadOrganizationParty(args.organizationId);
  if (!organization) return { ok: false, status: 404, error: "Организация не найдена" };
  const buyer = buildBuyerSnapshot(organization);
  if (!buyer.inn) {
    return { ok: false, status: 400, error: "Укажите ИНН организации в настройках — без него счёт не оформить" };
  }
  const tariff = await readTariff(args.tariffKey);
  if (!tariff || !tariff.active) return { ok: false, status: 400, error: "Тариф недоступен" };

  const existing = await db.paymentOrder.findFirst({
    where: { organizationId: args.organizationId, paymentMethod: "invoice", status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { ok: true, order: existing, created: false };

  const order = await db.paymentOrder.create({
    data: {
      email: args.email,
      tariffKey: tariff.key,
      amountRub: tariff.priceRub,
      description: `${tariff.title} на ${tariff.periodDays} дн. (счёт)`,
      status: "pending",
      isTest: isTestMode(),
      organizationId: args.organizationId,
      userId: args.userId,
      paymentMethod: "invoice",
      invoiceDueAt: new Date(Date.now() + INVOICE_VALID_DAYS * DAY_MS),
    },
  });
  return { ok: true, order, created: true };
}

export async function renderInvoice(orderId: number): Promise<{ order: PaymentOrder; pdf: Buffer } | null> {
  const order = await db.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order || order.paymentMethod !== "invoice" || !order.organizationId) return null;
  const [requisites, organization, tariff] = await Promise.all([
    readPlatformRequisites(),
    loadOrganizationParty(order.organizationId),
    readTariff(order.tariffKey),
  ]);
  if (!organization) return null;
  const draft = buildInvoiceDraft({
    order: { id: order.id, createdAt: order.createdAt, amountRub: Number(order.amountRub), bundleConfig: order.bundleConfig },
    tariff: tariff ? { title: tariff.title, periodDays: tariff.periodDays, priceRub: tariff.priceRub } : null,
    seller: buildSellerSnapshot(requisites),
    buyer: buildBuyerSnapshot(organization),
  });
  const [facsimile, stamp] = await Promise.all([
    readLegalImage("facsimile", requisites),
    readLegalImage("stamp", requisites),
  ]);
  return { order, pdf: renderInvoicePdf(draft, { facsimile, stamp }) };
}

/** Письмо со счётом клиенту и заметка админу — best-effort, после ответа клиенту. */
export async function deliverInvoice(orderId: number, organizationName: string): Promise<void> {
  const rendered = await renderInvoice(orderId);
  if (!rendered) return;
  const { order, pdf } = rendered;
  await sendInvoiceEmail({
    to: order.email,
    number: String(order.id),
    amountRub: Number(order.amountRub),
    dueAt: order.invoiceDueAt ?? new Date(order.createdAt.getTime() + INVOICE_VALID_DAYS * DAY_MS),
    organizationId: order.organizationId,
    pdf,
  }).catch((error) => console.error("[invoices] email failed", error));
  await notifyPlatformAdmin(
    [
      `🧾 Выставлен счёт №${order.id}`,
      `Организация: ${organizationName}`,
      `Сумма: ${Number(order.amountRub).toLocaleString("ru-RU")} ₽ · ${order.description}`,
      `Когда деньги придут — ROOT → организация → «Оплата поступила».`,
    ].join("\n"),
    { kind: "payment", dedupeKey: `invoice-created:${order.id}` }
  ).catch((error) => console.error("[invoices] admin notify failed", error));
}

export async function markInvoicePaid(
  orderId: number,
  byUserId: string
): Promise<{ ok: true; order: PaymentOrder } | { ok: false; status: number; error: string }> {
  const raw: Prisma.InputJsonValue = { manual: true, by: byUserId, at: new Date().toISOString() };
  const claimed = await db.paymentOrder.updateMany({
    where: { id: orderId, status: "pending", paymentMethod: "invoice" },
    data: { status: "paid", paidAt: new Date(), rawResult: raw },
  });
  if (claimed.count === 0) {
    const fresh = await db.paymentOrder.findUnique({ where: { id: orderId }, select: { status: true, paymentMethod: true } });
    if (!fresh || fresh.paymentMethod !== "invoice") return { ok: false, status: 404, error: "Счёт не найден" };
    return { ok: false, status: 409, error: fresh.status === "paid" ? "Счёт уже отмечен оплаченным" : `Счёт в статусе «${fresh.status}»` };
  }
  const stored = await db.paymentOrder.findUnique({ where: { id: orderId } });
  if (!stored) return { ok: false, status: 404, error: "Счёт не найден" };
  // Подписка, письмо «Оплата получена» с УПД, партнёрские начисления —
  // одной точкой с кассой. Внутри всё best-effort.
  await completePaidOrder(stored);
  return { ok: true, order: stored };
}

export async function cancelInvoice(orderId: number): Promise<boolean> {
  const result = await db.paymentOrder.updateMany({
    where: { id: orderId, status: "pending", paymentMethod: "invoice" },
    data: { status: "cancelled" },
  });
  return result.count > 0;
}
