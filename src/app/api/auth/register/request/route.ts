import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateVerificationCode,
  hashVerificationCode,
  verificationExpiresAt,
} from "@/lib/registration";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register/request
 *
 * Step 1 of the multi-step registration wizard. Accepts the email the caller
 * wants to register, creates or resets an EmailVerification row with a fresh
 * 6-digit code, and mails the raw code. No Organization / User is created yet;
 * that happens in /register/confirm after the user enters the code.
 *
 * Existing account short-circuit: if an active User already owns that email,
 * we reject with 409 instead of silently sending a code.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Введите корректный email" },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже существует" },
      { status: 409 }
    );
  }

  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);
  const expiresAt = verificationExpiresAt();

  await db.emailVerification.upsert({
    where: { email },
    update: { codeHash, expiresAt, attempts: 0 },
    create: { email, codeHash, expiresAt },
  });

  await sendVerificationEmail(email, code).catch((err) => {
    console.error("sendVerificationEmail failed", err);
  });

  // В dev (SMTP не настроен) возвращаем код прямо в ответе, чтобы
  // UI мог показать его inline. Иначе разработчик застревает на шаге
  // «введите код из письма», а письмо никогда не приходит.
  const smtpHost = (process.env.SMTP_HOST ?? "").trim();
  const isDev = !smtpHost || smtpHost === "localhost";
  return NextResponse.json({ ok: true, ...(isDev ? { devCode: code } : {}) });
}
