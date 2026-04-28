import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint — обслуживает форму саморегистрации сотрудника по
 * QR-коду. Никакого auth: вся защита через проверку токена.
 *
 * GET /api/join/[token]
 *   200 → { organizationName, positions: [{id,name,categoryKey}] }
 *   404 → токен не найден или истёк
 *   410 → уже использован
 *
 * POST /api/join/[token]
 *   Body: { fullName, phone, jobPositionId, password }
 *   200 → { ok: true, userId, email }
 *   404/410 → как у GET
 *   409 → телефон уже занят
 *   400 → валидация
 */

async function resolveValidToken(rawToken: string) {
  const tokenHash = hashInviteToken(rawToken);
  const row = await db.employeeJoinToken.findUnique({ where: { tokenHash } });
  if (!row) return { kind: "not_found" as const };
  if (row.expiresAt.getTime() <= Date.now()) return { kind: "not_found" as const };
  if (row.claimedAt) return { kind: "already_claimed" as const };
  return { kind: "ok" as const, row };
}

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const r = await resolveValidToken(token);
  if (r.kind === "not_found") {
    return NextResponse.json(
      { error: "Ссылка не найдена или истекла" },
      { status: 404 }
    );
  }
  if (r.kind === "already_claimed") {
    return NextResponse.json(
      { error: "Эта ссылка уже использована" },
      { status: 410 }
    );
  }

  const [org, positions] = await Promise.all([
    db.organization.findUnique({
      where: { id: r.row.organizationId },
      select: { name: true },
    }),
    db.jobPosition.findMany({
      where: { organizationId: r.row.organizationId },
      orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, categoryKey: true },
    }),
  ]);

  return NextResponse.json({
    organizationName: org?.name ?? "Организация",
    positions,
    suggestedJobPositionId: r.row.suggestedJobPositionId,
  });
}

const ClaimSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "ФИО слишком короткое")
    .max(120, "ФИО слишком длинное"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d[\d\s\-()]{6,20}$/, "Телефон в неверном формате"),
  jobPositionId: z.string().min(1, "Выберите должность"),
  password: z
    .string()
    .min(8, "Пароль не короче 8 символов")
    .max(120, "Пароль слишком длинный"),
});

function normalizePhone(input: string): string {
  // Убираем всё кроме цифр, форсируем 7 в начале (РФ).
  const digits = input.replace(/\D+/g, "");
  if (digits.startsWith("8") && digits.length === 11) return "+7" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 11) return "+" + digits;
  if (digits.length === 10) return "+7" + digits;
  return "+" + digits;
}

function deriveRoleFromCategory(categoryKey: string): string {
  // management должности → role=manager (имеют full workspace access)
  // staff должности → role=cook (универсальная staff-роль; обработка
  // конкретных привилегий идёт через JobPositionJournalAccess по
  // должности, не по role).
  return categoryKey === "management" ? "manager" : "cook";
}

export async function POST(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const r = await resolveValidToken(token);
  if (r.kind === "not_found") {
    return NextResponse.json(
      { error: "Ссылка не найдена или истекла" },
      { status: 404 }
    );
  }
  if (r.kind === "already_claimed") {
    return NextResponse.json(
      { error: "Эта ссылка уже использована" },
      { status: 410 }
    );
  }

  let body: z.infer<typeof ClaimSchema>;
  try {
    body = ClaimSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 }
      );
    }
    throw err;
  }

  // Должность должна принадлежать той же org что и токен.
  const position = await db.jobPosition.findFirst({
    where: { id: body.jobPositionId, organizationId: r.row.organizationId },
    select: { id: true, name: true, categoryKey: true },
  });
  if (!position) {
    return NextResponse.json(
      { error: "Должность не найдена в этой организации" },
      { status: 400 }
    );
  }

  const phone = normalizePhone(body.phone);

  // Уникальность по phone в рамках организации (телефон — natural key
  // для линковки с TasksFlow).
  const phoneTaken = await db.user.findFirst({
    where: { organizationId: r.row.organizationId, phone, archivedAt: null },
    select: { id: true },
  });
  if (phoneTaken) {
    return NextResponse.json(
      { error: "Сотрудник с таким телефоном уже зарегистрирован" },
      { status: 409 }
    );
  }

  // Email — synthetic (telephone-based), чтобы соблюсти @unique constraint
  // и не запрашивать его на форме (не у всех сотрудников вообще есть email).
  // Если в будущем admin захочет настоящий email — добавит через UI.
  const synthEmailLocal = phone.replace(/\D+/g, "");
  const orgSlug = r.row.organizationId.slice(0, 8);
  const email = `${synthEmailLocal}@${orgSlug}.staff.local`;

  const passwordHash = await bcrypt.hash(body.password, 10);

  const role = deriveRoleFromCategory(position.categoryKey);

  // Создаём User + помечаем токен использованным в одной транзакции.
  const newUser = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        name: body.fullName.trim(),
        phone,
        passwordHash,
        role,
        organizationId: r.row.organizationId,
        jobPositionId: position.id,
        positionTitle: position.name,
        isActive: true,
        // Сразу включаем ACL — иначе hasJournalAccess грантит всё.
        // Реальный набор журналов берётся из JobPositionJournalAccess.
        journalAccessMigrated: true,
      },
    });
    await tx.employeeJoinToken.update({
      where: { id: r.row.id },
      data: { claimedAt: new Date(), claimedUserId: u.id },
    });
    await tx.auditLog.create({
      data: {
        organizationId: r.row.organizationId,
        userId: u.id,
        userName: u.name,
        action: "employee.self_registered",
        entity: "User",
        entityId: u.id,
        details: {
          via: "qr_join_token",
          joinTokenId: r.row.id,
          positionName: position.name,
        },
      },
    });
    return u;
  });

  // Best-effort: попытка sync-up в TasksFlow если интеграция настроена.
  // Делаем in-fly без блокировки ответа — если упадёт, юзер всё равно
  // создан, админ сможет вручную нажать «Sync users».
  void (async () => {
    try {
      const integration = await db.tasksFlowIntegration.findUnique({
        where: { organizationId: r.row.organizationId },
        select: { id: true, enabled: true },
      });
      if (integration?.enabled) {
        const { syncUsersForIntegration } = await import(
          "@/lib/tasksflow-sync-users"
        ).catch(() => ({ syncUsersForIntegration: null as unknown as null }));
        if (syncUsersForIntegration) {
          await (syncUsersForIntegration as (id: string) => Promise<unknown>)(
            integration.id
          );
        }
      }
    } catch (e) {
      console.warn("[join] tasksflow auto-sync failed", e);
    }
  })();

  return NextResponse.json({ ok: true, userId: newUser.id, email });
}
