import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  VERIFICATION_MAX_ATTEMPTS,
  compareVerificationCode,
} from "@/lib/registration";
import { normalizePhone } from "@/lib/phone";
import { registrationConfirmRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ORG_TYPES = new Set([
  "restaurant",
  "meat",
  "dairy",
  "bakery",
  "confectionery",
  "other",
]);

/**
 * Завершение анкеты после мгновенной регистрации: подтверждение почты
 * кодом плюс данные организации и контакты.
 *
 * Телефон обязателен — без него не работает авто-связка сотрудника с
 * TasksFlow, которая ищет человека по номеру.
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

  if (!registrationConfirmRateLimiter.consume(`complete:${session.user.id}`)) {
    return NextResponse.json(
      { error: "Слишком много попыток. Подождите несколько минут" },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const organizationName =
    typeof body.organizationName === "string"
      ? body.organizationName.trim()
      : "";
  const organizationType =
    typeof body.organizationType === "string" &&
    VALID_ORG_TYPES.has(body.organizationType)
      ? body.organizationType
      : "other";
  const inn =
    typeof body.inn === "string" && body.inn.trim().length > 0
      ? body.inn.trim()
      : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = normalizePhone(
    typeof body.phone === "string" ? body.phone : null,
  );
  const newPassword =
    typeof body.newPassword === "string" && body.newPassword.length > 0
      ? body.newPassword
      : null;

  if (!organizationName || !name) {
    return NextResponse.json(
      { error: "Укажите название организации и ваше имя" },
      { status: 400 },
    );
  }
  if (!phone) {
    return NextResponse.json(
      { error: "Укажите телефон в формате +7XXXXXXXXXX" },
      { status: 400 },
    );
  }
  if (newPassword && newPassword.length < 6) {
    return NextResponse.json(
      { error: "Пароль должен быть не короче 6 символов" },
      { status: 400 },
    );
  }

  // Проверка кода — зеркально визарду регистрации.
  const verification = await db.emailVerification.findUnique({
    where: { email },
  });
  if (!verification) {
    return NextResponse.json(
      { error: "Сначала запросите код подтверждения" },
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
  const codeOk = await compareVerificationCode(code, verification.codeHash);
  if (!codeOk) {
    await db.emailVerification.update({
      where: { email },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Неверный код" }, { status: 400 });
  }

  const organizationId = getActiveOrgId(session);
  const passwordHash = newPassword ? await bcrypt.hash(newPassword, 12) : null;

  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: { name: organizationName, type: organizationType, inn },
    });
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        name,
        phone,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    await tx.emailVerification.delete({ where: { email } });
  });

  return NextResponse.json({ ok: true });
}
