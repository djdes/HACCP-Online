import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { readJson } from "@/lib/partners/api";
import { isPartnerAccessLevel } from "@/lib/partners/access-guard";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { setClientAccessLevel } from "@/lib/partners/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH { accessLevel } — админ платформы меняет уровень доступа
 * консультанта к организации.
 *
 * Нужен для поддержки: клиент звонит «консультант не может ничего
 * заполнить», и вместо инструкции «зайдите в настройки, найдите раздел»
 * администратор переключает сам. Клиенту уходит то же уведомление, что
 * и при смене уровня партнёром — `by: "partner"`, потому что для клиента
 * важно не кто нажал кнопку, а что доступ консультанта изменился.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string; orgId: string }> }) {
  const session = await requireRoot();
  const { id, orgId } = await ctx.params;
  const body = await readJson<{ accessLevel?: unknown }>(request);

  if (!isPartnerAccessLevel(body.accessLevel)) {
    return NextResponse.json({ error: "Выберите уровень доступа" }, { status: 400 });
  }

  try {
    await setClientAccessLevel({
      organizationId: orgId,
      partnerId: id,
      level: body.accessLevel,
      actorUserId: session.user.id,
      by: "partner",
    });
    return NextResponse.json({ ok: true, accessLevel: body.accessLevel });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
