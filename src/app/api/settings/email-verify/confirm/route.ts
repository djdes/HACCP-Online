import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  VERIFICATION_MAX_ATTEMPTS,
  compareVerificationCode,
} from "@/lib/registration";
import { registrationConfirmRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Подтверждение почты кодом из письма.
 *
 * Раньше эта проверка стояла внутри анкеты регистрации и блокировала
 * кнопку «Готово»: человек не мог закончить настройку, пока не сходит
 * в почту и не перепечатает шесть цифр. Теперь это отдельный шаг в
 * настройках, и он ничего не блокирует — отметка нужна для связи с
 * клиентом, а не для доступа.
 */
export async function POST(request: Request) {
  const session = await requireAuth();
  const email = session.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "У аккаунта не указана почта" },
      { status: 400 },
    );
  }

  if (
    !registrationConfirmRateLimiter.consume(`email-verify:${session.user.id}`)
  ) {
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите несколько минут" },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const code =
    body && typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Введите код" }, { status: 400 });
  }

  const verification = await db.emailVerification.findUnique({
    where: { email },
  });
  if (!verification) {
    return NextResponse.json(
      { error: "Сначала запросите код" },
      { status: 400 },
    );
  }
  if (verification.expiresAt.getTime() < Date.now()) {
    await db.emailVerification.delete({ where: { email } });
    return NextResponse.json(
      { error: "Код устарел. Запросите новый" },
      { status: 400 },
    );
  }
  if (verification.attempts >= VERIFICATION_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Слишком много попыток. Запросите новый код" },
      { status: 429 },
    );
  }

  const ok = await compareVerificationCode(code, verification.codeHash);
  if (!ok) {
    await db.emailVerification.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Неверный код" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    await tx.emailVerification.delete({ where: { email } });
  });

  return NextResponse.json({ ok: true });
}
