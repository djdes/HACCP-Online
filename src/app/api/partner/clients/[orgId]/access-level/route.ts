import { NextResponse } from "next/server";

import { isPartnerAccessLevel } from "@/lib/partners/access-guard";
import { readJson, requirePartnerApi } from "@/lib/partners/api";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { setClientAccessLevel } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH { accessLevel } — консультант меняет свой уровень доступа.
 *
 * Клиенту уходит уведомление тремя каналами, а событие попадает в его
 * журнал действий: речь о том, кто может писать в его журналы, и узнать
 * об этом он должен без чтения настроек. Вернуть «только просмотр» или
 * отключить консультанта клиент может у себя в один клик.
 *
 * `partnerId` в вызове обязателен — он сужает привязку до своей.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const auth = await requirePartnerApi();
  if (!auth.ok) return auth.response;
  const { session, membership } = auth.ctx;
  const { orgId } = await ctx.params;

  const body = await readJson<{ accessLevel?: unknown }>(request);
  if (!isPartnerAccessLevel(body.accessLevel)) {
    return NextResponse.json({ error: "Выберите уровень доступа" }, { status: 400 });
  }

  try {
    await setClientAccessLevel({
      organizationId: orgId,
      partnerId: membership.partnerId,
      level: body.accessLevel,
      actorUserId: session.user.id,
      by: "partner",
    });
    return NextResponse.json({ ok: true, accessLevel: body.accessLevel });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
