import { NextResponse } from "next/server";

import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { actorName, optionalPartnerApi, readJson } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import {
  PARTNER_TYPE_LABELS,
  applyForPartnership,
  isSlugAvailable,
  parseApplicationInput,
  partnerPublicUrl,
} from "@/lib/partners/service";
import { suggestSlug, validateSlug } from "@/lib/partners/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «Стать партнёром» — со стороны организации.
 *
 * GET  → статус заявки текущего пользователя + подсказки для формы
 *        (предзаполнение из организации, предложенный slug).
 * POST → подать заявку (или заново после отказа).
 * GET ?slug=<x> → проверка доступности slug для live-валидации формы.
 */
export async function GET(request: Request) {
  const auth = await optionalPartnerApi();
  if (!auth.ok) return auth.response;
  const { session, membership } = auth;

  const url = new URL(request.url);
  const slugProbe = url.searchParams.get("slug");
  if (slugProbe !== null) {
    const check = validateSlug(slugProbe);
    if (!check.ok) return NextResponse.json({ slug: slugProbe, available: false, error: check.error });
    const available = await isSlugAvailable(check.slug, membership?.partnerId);
    return NextResponse.json({ slug: check.slug, available, error: available ? null : "Адрес уже занят" });
  }

  const org = session.user.partnerAccess
    ? null
    : await db.organization.findUnique({
        where: { id: getActiveOrgId(session) },
        select: { name: true, inn: true, phone: true, address: true },
      });

  return NextResponse.json({
    membership: membership
      ? {
          partnerId: membership.partnerId,
          role: membership.role,
          status: membership.partner.status,
          slug: membership.partner.slug,
          code: membership.partner.code,
          companyName: membership.partner.companyName,
          brandName: membership.partner.brandName,
          publicUrl: partnerPublicUrl(membership.partner.slug),
          reviewComment: membership.partner.reviewComment,
          createdAt: membership.partner.createdAt.toISOString(),
        }
      : null,
    canApply: !session.user.partnerAccess && hasFullWorkspaceAccess(session.user),
    prefill: {
      companyName: org?.name ?? "",
      inn: org?.inn ?? "",
      phone: org?.phone ?? "",
      city: "",
      email: session.user.email ?? "",
      slug: suggestSlug(org?.name ?? ""),
    },
    types: PARTNER_TYPE_LABELS,
  });
}

export async function POST(request: Request) {
  const auth = await optionalPartnerApi();
  if (!auth.ok) return auth.response;
  const { session } = auth;
  if (session.user.partnerAccess) {
    return NextResponse.json({ error: "Из кабинета клиента заявку подать нельзя" }, { status: 403 });
  }
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Заявку подаёт руководитель организации" }, { status: 403 });
  }
  try {
    const input = parseApplicationInput(await readJson(request));
    const result = await applyForPartnership(input, {
      userId: session.user.id,
      organizationId: getActiveOrgId(session),
      name: actorName(session),
    });
    return NextResponse.json({ ok: true, ...result, publicUrl: partnerPublicUrl(result.slug) });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
