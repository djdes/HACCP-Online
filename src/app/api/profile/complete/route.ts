import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { registrationConfirmRateLimiter } from "@/lib/rate-limit";
import { completeProfileSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Анкета после мгновенной регистрации: данные организации и контакты.
 *
 * Подтверждения почты здесь больше нет. Раньше «Готово» не работало,
 * пока человек не закажет код и не перепечатает его из письма, — это
 * ещё один шаг между регистрацией и первым журналом, и на нём люди
 * отваливались. Почта подтверждается отдельно в настройках
 * (/api/settings/email-verify), и ничего не блокирует.
 *
 * Телефон обязателен: без него не работает авто-связка сотрудника с
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

  const parsed = completeProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const phone = normalizePhone(data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "Укажите телефон в формате +7XXXXXXXXXX" },
      { status: 400 },
    );
  }

  const organizationId = getActiveOrgId(session);
  const passwordHash = data.newPassword
    ? await bcrypt.hash(data.newPassword, 12)
    : null;

  // Имя необязательное: если его не назвали, подставляем название
  // организации. Оставлять почту в поле имени нельзя — она протекает
  // в шапку кабинета и в подписи под записями журналов.
  const displayName = data.name?.trim() || data.organizationName;

  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        name: data.organizationName,
        type: data.sphere,
        ownershipKind: data.ownershipKind,
        locationsCount: data.locationsCount,
        inn: data.inn?.trim() || null,
      },
    });
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        name: displayName,
        phone,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
