import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requirePartnerApi } from "@/lib/partners/api";
import { getPartnerBrandById, logoUrlFor } from "@/lib/partners/branding";
import { PARTNER_AGREEMENT_URL } from "@/lib/partners/invite-texts";
import { getCurrentRewardRule } from "@/lib/partners/schema-extras";
import { PARTNER_TYPE_LABELS, PAYOUT_TYPE_LABELS, partnerPublicUrl } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Профиль партнёра для шапки кабинета и раздела «Вознаграждение»:
 * ссылка и код, статус договора, реквизиты, действующие правила
 * (только чтение — версии правит ROOT).
 */
export async function GET() {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { membership, session } = auth.ctx;

  const [partner, brand, rule] = await Promise.all([
    db.partner.findUnique({
      where: { id: membership.partnerId },
      select: {
        id: true,
        slug: true,
        code: true,
        status: true,
        type: true,
        companyName: true,
        city: true,
        phone: true,
        telegram: true,
        contactEmail: true,
        onboardingDoneAt: true,
        payoutType: true,
        payoutDetails: true,
        agreementSignedAt: true,
        agreementNumber: true,
        createdAt: true,
      },
    }),
    getPartnerBrandById(membership.partnerId),
    getCurrentRewardRule(),
  ]);
  if (!partner || !brand) return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 });

  return NextResponse.json({
    me: { userId: session.user.id, role: membership.role, name: session.user.name ?? null },
    partner: {
      id: partner.id,
      slug: partner.slug,
      code: partner.code,
      status: partner.status,
      type: partner.type,
      typeLabel: PARTNER_TYPE_LABELS[partner.type as keyof typeof PARTNER_TYPE_LABELS] ?? partner.type,
      companyName: partner.companyName,
      city: partner.city,
      phone: partner.phone,
      telegram: partner.telegram,
      contactEmail: partner.contactEmail,
      publicUrl: partnerPublicUrl(partner.slug),
      onboardingDone: Boolean(partner.onboardingDoneAt),
      createdAt: partner.createdAt.toISOString(),
    },
    brand: {
      brandName: brand.brandName,
      logoUrl: brand.hasLogoLight ? logoUrlFor(brand, "light") : null,
      accentColor: brand.accentColor,
      supportPhone: brand.supportPhone,
      supportTelegram: brand.supportTelegram,
      supportEmail: brand.supportEmail,
    },
    payout: {
      type: partner.payoutType,
      typeLabel: partner.payoutType
        ? (PAYOUT_TYPE_LABELS[partner.payoutType as keyof typeof PAYOUT_TYPE_LABELS] ?? partner.payoutType)
        : null,
      details: partner.payoutDetails,
      filled: Boolean(partner.payoutType && partner.payoutDetails),
    },
    agreement: {
      signed: Boolean(partner.agreementSignedAt),
      signedAt: partner.agreementSignedAt ? partner.agreementSignedAt.toISOString() : null,
      number: partner.agreementNumber,
      url: PARTNER_AGREEMENT_URL,
    },
    rules: rule,
    labels: { payoutTypes: PAYOUT_TYPE_LABELS },
  });
}
