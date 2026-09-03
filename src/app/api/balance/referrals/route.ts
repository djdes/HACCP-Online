import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { domainAcceptsMail } from "@/lib/mail-domain";
import {
  REFERRAL_INVITES_PER_DAY,
  REFERRAL_INVITE_REPEAT_HOURS,
} from "@/lib/balance/constants";
import { ensureReferralCode, listReferralInvites } from "@/lib/balance/referral";
import { sendReferralInviteEmail } from "@/lib/balance/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/balance/referrals — пригласить друга письмом.
 *
 * Письмо уходит от WeSetup, но с именем рекомендателя в теле. Лимиты
 * здесь не про удобство: без них эндпоинт превращается в открытый релей,
 * с которого можно рассылать что угодно на любые адреса.
 */
const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  message: z.string().trim().max(500).optional(),
});

const HOUR_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const session = await requireAuth();
  const organizationId = getActiveOrgId(session);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Укажите корректный адрес электронной почты" },
      { status: 400 },
    );
  }
  const { email, message } = parsed.data;

  if (email === session.user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "Это ваш собственный адрес" },
      { status: 400 },
    );
  }

  const registered = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (registered) {
    return NextResponse.json(
      { error: "Этот адрес уже зарегистрирован в WeSetup — бонуса не будет" },
      { status: 409 },
    );
  }

  if (!(await domainAcceptsMail(email.split("@")[1] ?? ""))) {
    return NextResponse.json(
      { error: "Такого почтового домена не существует — проверьте адрес" },
      { status: 400 },
    );
  }

  const since = new Date(Date.now() - 24 * HOUR_MS);
  const sentToday = await db.referralInvite.count({
    where: { organizationId, createdAt: { gte: since } },
  });
  if (sentToday >= REFERRAL_INVITES_PER_DAY) {
    return NextResponse.json(
      {
        error: `Не больше ${REFERRAL_INVITES_PER_DAY} приглашений в сутки. Попробуйте завтра`,
      },
      { status: 429 },
    );
  }

  const existing = await db.referralInvite.findUnique({
    where: { organizationId_email: { organizationId, email } },
    select: { createdAt: true },
  });
  if (
    existing &&
    Date.now() - existing.createdAt.getTime() <
      REFERRAL_INVITE_REPEAT_HOURS * HOUR_MS
  ) {
    return NextResponse.json(
      { error: "На этот адрес уже отправляли приглашение сегодня" },
      { status: 429 },
    );
  }

  const [code, organization] = await Promise.all([
    ensureReferralCode(organizationId),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
  ]);

  const sent = await sendReferralInviteEmail({
    to: email,
    fromOrganizationName: organization?.name ?? "Ваши коллеги",
    fromUserName: session.user.name ?? session.user.email ?? "Коллега",
    code,
    message: message ?? null,
  }).catch((error) => {
    console.error("sendReferralInviteEmail failed", error);
    return false;
  });
  if (!sent) {
    return NextResponse.json(
      { error: "Письмо не ушло. Попробуйте позже или отправьте ссылку сами" },
      { status: 502 },
    );
  }

  // Запись создаём только после успешной отправки: иначе повтор
  // упрётся в антиспам, хотя письма человек так и не получил.
  await db.referralInvite.upsert({
    where: { organizationId_email: { organizationId, email } },
    create: {
      organizationId,
      email,
      invitedByUserId: session.user.id,
    },
    update: { createdAt: new Date(), invitedByUserId: session.user.id },
  });

  return NextResponse.json({
    ok: true,
    invites: await listReferralInvites(organizationId),
  });
}
