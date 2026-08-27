import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  generateVerificationCode,
  hashVerificationCode,
  verificationExpiresAt,
} from "@/lib/registration";
import { sendVerificationEmail } from "@/lib/email";
import { registrationCodeRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Код подтверждения почты для уже вошедшего пользователя.
 *
 * Отдельный маршрут, а не переиспользование `/api/auth/register/request`:
 * тот отвечает 409 «пользователь уже существует», что здесь как раз
 * норма — аккаунт создан мгновенной регистрацией, почта просто ещё не
 * подтверждена.
 *
 * Адрес берём из сессии, а не из тела запроса: иначе можно было бы
 * рассылать коды на чужие почты от имени сервиса.
 */
export async function POST() {
  const session = await requireAuth();
  const email = session.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "У аккаунта не указана почта" },
      { status: 400 },
    );
  }

  if (!registrationCodeRateLimiter.consume(`complete:${session.user.id}`)) {
    return NextResponse.json(
      { error: "Слишком часто. Попробуйте через несколько минут" },
      { status: 429 },
    );
  }

  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);
  const expiresAt = verificationExpiresAt();

  await db.emailVerification.upsert({
    where: { email },
    create: { email, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0 },
  });

  await sendVerificationEmail(email, code).catch((err) =>
    console.error("profile/complete send-code failed", err),
  );

  return NextResponse.json({ ok: true });
}
