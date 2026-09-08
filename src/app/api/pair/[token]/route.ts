import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite-tokens";
import { issueSession } from "@/lib/issue-session";
import { normalizePhone } from "@/lib/phone";
import { loginRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(6, "Минимум 6 знаков").max(128),
});

/**
 * POST /api/pair/[token] — сотрудник задаёт себе пароль по ссылке от
 * руководителя и сразу входит.
 *
 * Сессия выдаётся тем же `issueSession`, что и обычный вход, поэтому
 * человек оказывается внутри кабинета, не вводя пароль повторно —
 * телефон он отдаёт обратно руководителю уже работающим.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const ip = clientIp(request) ?? "unknown";
  if (!loginRateLimiter.consume(`pair:${ip}`)) {
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите 5 минут." },
      { status: 429 },
    );
  }

  const { token } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Проверьте пароль" },
      { status: 400 },
    );
  }

  const row = await db.staffPairToken.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { user: { include: { organization: true } } },
  });

  if (!row || row.consumedAt || row.expiresAt < new Date()) {
    // Один текст на все случаи: по разнице ответов подбирались бы живые
    // ссылки.
    return NextResponse.json(
      { error: "Ссылка недействительна или уже использована" },
      { status: 400 },
    );
  }
  if (!row.user.isActive || row.user.archivedAt) {
    return NextResponse.json(
      { error: "Ссылка недействительна или уже использована" },
      { status: 400 },
    );
  }

  const phone = normalizePhone(row.user.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "В карточке сотрудника нет телефона — обратитесь к руководителю" },
      { status: 400 },
    );
  }

  // Не даём создать вторую пару «тот же телефон + пароль»: тогда вход по
  // телефону стал бы неоднозначным, и `verifyPhonePassword` отказал бы
  // обоим. Проверяем ЗДЕСЬ, а не при входе, потому что здесь ещё можно
  // объяснить человеку, что делать.
  const rival = await db.user.findFirst({
    where: {
      phone,
      id: { not: row.user.id },
      isActive: true,
      archivedAt: null,
      passwordHash: { not: "" },
    },
    select: { id: true },
  });
  if (rival) {
    return NextResponse.json(
      {
        error:
          "Этот номер уже занят другим сотрудником с паролем. Попросите руководителя указать вам другой номер.",
      },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await db.$transaction([
    db.user.update({
      where: { id: row.user.id },
      data: { passwordHash, phone },
    }),
    db.staffPairToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  await logAudit({
    organizationId: row.organizationId,
    userId: row.user.id,
    userName: row.user.name ?? undefined,
    action: "employee.paired_device",
    entity: "User",
    entityId: row.user.id,
    details: { phone },
    ipAddress: ip === "unknown" ? undefined : ip,
  }).catch(() => {});

  return issueSession(
    NextResponse.json({ ok: true, redirect: "/mini" }),
    { ...row.user, email: row.user.email },
    row.user.organization.name,
  );
}
