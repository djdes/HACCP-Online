import { NextResponse } from "next/server";
import { normalizeSphere } from "@/lib/org-profile";
import { defaultDisabledCodesFor } from "@/lib/sphere-journal-rules";
import bcrypt from "bcryptjs";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { registrationConfirmRateLimiter } from "@/lib/rate-limit";
import {
  DEFAULT_OWNER_POSITION,
  OWNER_POSITION_CATEGORY,
} from "@/lib/sphere-positions";
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

  // Набор журналов по сфере. Пишем только если организация ещё не
  // трогала список руками: пустой `disabledJournalCodes` означает
  // «включено всё» — состояние сразу после регистрации. Если человек
  // уже что-то выключал, его выбор важнее нашего дефолта.
  const current = await db.organization.findUnique({
    where: { id: organizationId },
    select: { disabledJournalCodes: true },
  });
  const untouchedJournals =
    !Array.isArray(current?.disabledJournalCodes) ||
    current.disabledJournalCodes.length === 0;

  // «Оформить меня сотрудником»: владелец уже есть в команде, но без
  // должности — он висит в /settings/users безымянной строкой. Ставим ему
  // должность из управленческого каталога, заводя её при необходимости.
  const positionName = data.asEmployee
    ? data.positionName?.trim() || DEFAULT_OWNER_POSITION
    : null;

  await db.$transaction(async (tx) => {
    let jobPositionId: string | null = null;
    if (positionName) {
      const existing = await tx.jobPosition.findUnique({
        where: {
          organizationId_categoryKey_name: {
            organizationId,
            categoryKey: OWNER_POSITION_CATEGORY,
            name: positionName,
          },
        },
        select: { id: true },
      });
      if (existing) {
        jobPositionId = existing.id;
      } else {
        const last = await tx.jobPosition.findFirst({
          where: { organizationId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        const created = await tx.jobPosition.create({
          data: {
            organizationId,
            categoryKey: OWNER_POSITION_CATEGORY,
            name: positionName,
            sortOrder: (last?.sortOrder ?? 0) + 1,
          },
          select: { id: true },
        });
        jobPositionId = created.id;
      }
    }

    await tx.organization.update({
      where: { id: organizationId },
      data: {
        name: data.organizationName,
        type: data.sphere,
        ownershipKind: data.ownershipKind,
        locationsCount: data.locationsCount,
        inn: data.inn?.trim() || null,
        ...(untouchedJournals
          ? { disabledJournalCodes: defaultDisabledCodesFor(normalizeSphere(data.sphere)) }
          : {}),
      },
    });
    await tx.user.update({
      where: { id: session.user.id },
      data: {
        name: displayName,
        phone,
        ...(passwordHash ? { passwordHash } : {}),
        // positionTitle дублируем: легаси-экраны читают его, а не связь.
        ...(jobPositionId && positionName
          ? { jobPositionId, positionTitle: positionName }
          : {}),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
