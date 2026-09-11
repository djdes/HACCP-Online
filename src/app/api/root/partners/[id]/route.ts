import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { requireRoot } from "@/lib/auth-helpers";
import { readJson } from "@/lib/partners/api";
import {
  parsePartnerAdminPatch,
  payoutChanged,
  updatePartnerAsAdmin,
} from "@/lib/partners/admin-edit";
import { getPartnerForAdmin } from "@/lib/partners/admin";
import { sendPartnerEditedByAdminEmail } from "@/lib/partners/emails";
import { partnerErrorResponse } from "@/lib/partners/errors";
import { notifyEmployee } from "@/lib/telegram";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireRoot();
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await getPartnerForAdmin(id));
  } catch (error) {
    return partnerErrorResponse(error);
  }
}

/**
 * PATCH — правка карточки партнёра администратором платформы.
 *
 * Меняются только присланные поля: анкета, вывеска, ссылка, номер
 * договора и реквизиты для выплат. Пустое тело — 400, чтобы случайный
 * запрос не выглядел как успешное сохранение.
 *
 * Каждая правка попадает в аудит с «было → стало» (банковские реквизиты
 * — маскированными), а о смене реквизитов партнёр узнаёт письмом и в
 * Telegram: это счёт, куда уходят его деньги, и тихо менять его нельзя.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireRoot();
  const { id } = await ctx.params;
  const body = await readJson<Record<string, unknown>>(request);

  try {
    const patch = parsePartnerAdminPatch(body);
    const { before, after } = await updatePartnerAsAdmin(id, patch);

    await recordAuditLog({
      request,
      session,
      // Партнёр не принадлежит организации — пишем в платформенный скоуп,
      // как это делают другие действия ROOT'а над не-орг сущностями.
      organizationId: "platform",
      action: "partner.admin_updated",
      entity: "Partner",
      entityId: id,
      details: { before, after },
    });

    if (payoutChanged(before, after)) {
      const partner = await db.partner.findUnique({
        where: { id },
        select: { contactEmail: true, companyName: true, applicantUserId: true },
      });
      if (partner) {
        void sendPartnerEditedByAdminEmail({
          to: partner.contactEmail,
          companyName: partner.companyName,
        }).catch((err) => console.error("partner payout edit email failed", err));
        void notifyEmployee(
          partner.applicantUserId,
          `🏦 Реквизиты для выплат в вашей партнёрской карточке изменил администратор WeSetup.\nПроверьте их в разделе «Вознаграждение». Если это были не вы и не по вашей просьбе — напишите нам сразу.`,
        ).catch((err) => console.error("partner payout edit telegram failed", err));
      }
    }

    return NextResponse.json({ ok: true, partner: after });
  } catch (error) {
    return partnerErrorResponse(error);
  }
}
