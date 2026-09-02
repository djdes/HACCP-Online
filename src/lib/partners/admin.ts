import { db } from "@/lib/db";

import { listAccruals, splitOrderAmount, summarizeBalances } from "./accruals";
import { PartnerError } from "./errors";
import {
  PARTNER_STATUSES,
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  PAYOUT_TYPE_LABELS,
  partnerPublicUrl,
  type PartnerStatus,
} from "./service";

/**
 * Данные для ROOT-раздела «Партнёры»: список заявок/партнёров и карточка.
 * Проверки прав — в роутах (`requireRoot`), здесь только выборки.
 */

export type AdminPartnerRow = {
  id: string;
  slug: string;
  code: string;
  status: PartnerStatus;
  statusLabel: string;
  type: string;
  typeLabel: string;
  companyName: string;
  brandName: string;
  inn: string;
  city: string;
  phone: string;
  telegram: string | null;
  contactEmail: string;
  venuesCount: number;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantOrganizationName: string | null;
  activeClients: number;
  totalClients: number;
  agreementSigned: boolean;
  payoutFilled: boolean;
  onboardingDone: boolean;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

function asStatus(value: string): PartnerStatus {
  return (PARTNER_STATUSES as readonly string[]).includes(value) ? (value as PartnerStatus) : "pending";
}

const ROW_SELECT = {
  id: true,
  slug: true,
  code: true,
  status: true,
  type: true,
  companyName: true,
  inn: true,
  city: true,
  phone: true,
  telegram: true,
  contactEmail: true,
  venuesCount: true,
  reviewComment: true,
  reviewedAt: true,
  onboardingDoneAt: true,
  payoutType: true,
  payoutDetails: true,
  agreementSignedAt: true,
  agreementNumber: true,
  applicantOrganizationId: true,
  createdAt: true,
  applicant: { select: { name: true, email: true, organization: { select: { name: true } } } },
  branding: { select: { brandName: true } },
  _count: { select: { clients: true } },
} as const;

type RowSource = {
  id: string;
  slug: string;
  code: string;
  status: string;
  type: string;
  companyName: string;
  inn: string;
  city: string;
  phone: string;
  telegram: string | null;
  contactEmail: string;
  venuesCount: number;
  reviewComment: string | null;
  reviewedAt: Date | null;
  onboardingDoneAt: Date | null;
  payoutType: string | null;
  payoutDetails: unknown;
  agreementSignedAt: Date | null;
  createdAt: Date;
  applicant: { name: string | null; email: string | null; organization: { name: string } | null } | null;
  branding: { brandName: string } | null;
  _count: { clients: number };
};

function toRow(p: RowSource, activeClients: number): AdminPartnerRow {
  const status = asStatus(p.status);
  return {
    id: p.id,
    slug: p.slug,
    code: p.code,
    status,
    statusLabel: PARTNER_STATUS_LABELS[status],
    type: p.type,
    typeLabel: PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS] ?? p.type,
    companyName: p.companyName,
    brandName: p.branding?.brandName ?? p.companyName,
    inn: p.inn,
    city: p.city,
    phone: p.phone,
    telegram: p.telegram,
    contactEmail: p.contactEmail,
    venuesCount: p.venuesCount,
    applicantName: p.applicant?.name ?? null,
    applicantEmail: p.applicant?.email ?? null,
    applicantOrganizationName: p.applicant?.organization?.name ?? null,
    activeClients,
    totalClients: p._count.clients,
    agreementSigned: Boolean(p.agreementSignedAt),
    payoutFilled: Boolean(p.payoutType && p.payoutDetails),
    onboardingDone: Boolean(p.onboardingDoneAt),
    reviewComment: p.reviewComment,
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listPartnersForAdmin(status?: PartnerStatus | "all"): Promise<{
  partners: AdminPartnerRow[];
  counts: Record<PartnerStatus, number>;
}> {
  const where = status && status !== "all" ? { status } : {};
  const [rows, active, grouped] = await Promise.all([
    db.partner.findMany({ where, orderBy: [{ createdAt: "desc" }], select: ROW_SELECT }),
    db.partnerClient.groupBy({ by: ["partnerId"], where: { detachedAt: null }, _count: { _all: true } }),
    db.partner.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const activeMap = new Map(active.map((a) => [a.partnerId, a._count._all]));
  const counts: Record<PartnerStatus, number> = { pending: 0, active: 0, rejected: 0, suspended: 0 };
  for (const g of grouped) counts[asStatus(g.status)] += g._count._all;
  return { partners: rows.map((p) => toRow(p, activeMap.get(p.id) ?? 0)), counts };
}

export async function getPartnerForAdmin(partnerId: string) {
  const p = await db.partner.findUnique({ where: { id: partnerId }, select: ROW_SELECT });
  if (!p) throw new PartnerError("Партнёр не найден", 404);

  const [clients, members, accruals, invitesGrouped, activeCount] = await Promise.all([
    db.partnerClient.findMany({
      where: { partnerId },
      orderBy: { attachedAt: "desc" },
      select: {
        id: true,
        organizationId: true,
        accessLevel: true,
        source: true,
        attachedAt: true,
        detachedAt: true,
        detachedBy: true,
        clientHidesBranding: true,
        firstPaymentAt: true,
        organization: { select: { name: true, subscriptionPlan: true, subscriptionEnd: true } },
      },
    }),
    db.partnerUser.findMany({
      where: { partnerId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, user: { select: { name: true, email: true } } },
    }),
    listAccruals({ partnerId, take: 300 }),
    db.partnerInvite.groupBy({ by: ["status"], where: { partnerId }, _count: { _all: true } }),
    db.partnerClient.count({ where: { partnerId, detachedAt: null } }),
  ]);

  // Оплаченные заказы клиентов за время привязки: отсюда ROOT отмечает
  // отгрузку оборудования (начисление 15 %) и возвраты (сторно).
  const orders = clients.length
    ? await db.paymentOrder.findMany({
        where: {
          status: "paid",
          OR: clients.map((c) => ({
            organizationId: c.organizationId,
            paidAt: { gte: c.attachedAt, ...(c.detachedAt ? { lte: c.detachedAt } : {}) },
          })),
        },
        orderBy: [{ paidAt: "desc" }],
        take: 200,
        select: {
          id: true,
          organizationId: true,
          tariffKey: true,
          amountRub: true,
          bundleConfig: true,
          paidAt: true,
          shippedAt: true,
          refundedAt: true,
        },
      })
    : [];
  const clientNames = new Map(clients.map((c) => [c.organizationId, c.organization.name]));

  return {
    partner: {
      ...toRow(p, activeCount),
      publicUrl: partnerPublicUrl(p.slug),
      agreementNumber: p.agreementNumber,
      agreementSignedAt: p.agreementSignedAt ? p.agreementSignedAt.toISOString() : null,
      payoutType: p.payoutType,
      payoutTypeLabel: p.payoutType
        ? (PAYOUT_TYPE_LABELS[p.payoutType as keyof typeof PAYOUT_TYPE_LABELS] ?? p.payoutType)
        : null,
      payoutDetails: p.payoutDetails,
      applicantOrganizationId: p.applicantOrganizationId,
    },
    clients: clients.map((c) => ({
      partnerClientId: c.id,
      organizationId: c.organizationId,
      name: c.organization.name,
      plan: c.organization.subscriptionPlan,
      subscriptionEnd: c.organization.subscriptionEnd ? c.organization.subscriptionEnd.toISOString() : null,
      accessLevel: c.accessLevel,
      source: c.source,
      attachedAt: c.attachedAt.toISOString(),
      detachedAt: c.detachedAt ? c.detachedAt.toISOString() : null,
      detachedBy: c.detachedBy,
      clientHidesBranding: c.clientHidesBranding,
      firstPaymentAt: c.firstPaymentAt ? c.firstPaymentAt.toISOString() : null,
    })),
    members: members.map((m) => ({ id: m.id, role: m.role, name: m.user.name, email: m.user.email })),
    accruals: accruals.map((a) => ({
      ...a,
      date: a.date.toISOString(),
      paidAt: a.paidAt ? a.paidAt.toISOString() : null,
    })),
    balances: summarizeBalances(accruals),
    orders: orders.map((o) => {
      const split = splitOrderAmount(o);
      return {
        id: o.id,
        organizationId: o.organizationId,
        clientName: (o.organizationId && clientNames.get(o.organizationId)) || "—",
        tariffKey: o.tariffKey,
        amountRub: Number(o.amountRub),
        hardwareRub: split.hardwareRub,
        paidAt: o.paidAt ? o.paidAt.toISOString() : null,
        shippedAt: o.shippedAt ? o.shippedAt.toISOString() : null,
        refundedAt: o.refundedAt ? o.refundedAt.toISOString() : null,
      };
    }),
    invites: Object.fromEntries(invitesGrouped.map((g) => [g.status, g._count._all])) as Record<string, number>,
  };
}
