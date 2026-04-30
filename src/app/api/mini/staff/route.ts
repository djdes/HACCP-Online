import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getUserPermissions } from "@/lib/permissions-server";
import { normalizePhone } from "@/lib/phone";
import { getManagerScope, filterSubordinates } from "@/lib/manager-scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAuth();
  const perms = await getUserPermissions(session.user.id);
  if (!perms.has("staff.view") && !session.user.isRoot) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const orgId = getActiveOrgId(session);
  const [employees, positions, scope] = await Promise.all([
    db.user.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        telegramChatId: true,
        jobPositionId: true,
        positionTitle: true,
        role: true,
        isActive: true,
      },
    }),
    db.jobPosition.findMany({
      where: { organizationId: orgId },
      orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, categoryKey: true },
    }),
    getManagerScope(session.user.id, orgId),
  ]);

  const filteredEmployees = filterSubordinates(
    employees,
    scope,
    session.user.id
  );

  return NextResponse.json({
    employees: filteredEmployees.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      positionTitle: u.positionTitle,
      telegramLinked: Boolean(u.telegramChatId),
      isActive: u.isActive,
    })),
    positions: positions.map((p) => ({
      id: p.id,
      name: p.name,
      categoryKey: p.categoryKey,
    })),
  });
}

const createSchema = z.object({
  jobPositionId: z.string().min(1, "Выберите должность"),
  fullName: z.string().trim().min(2, "ФИО слишком короткое").max(200),
  phone: z.string().trim().min(1, "Укажите телефон"),
});

function syntheticEmail(orgId: string) {
  const salt = crypto.randomBytes(6).toString("hex");
  return `staff-${salt}@${orgId}.local.haccp`;
}

function deriveRoleFromCategory(categoryKey: string): string {
  return categoryKey === "management" ? "manager" : "cook";
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const perms = await getUserPermissions(session.user.id);
  if (!perms.has("staff.manage") && !session.user.isRoot) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const orgId = getActiveOrgId(session);
  let parsed;
  try {
    parsed = createSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Не удалось прочитать запрос" }, { status: 400 });
  }

  const position = await db.jobPosition.findFirst({
    where: { id: parsed.jobPositionId, organizationId: orgId },
  });
  if (!position) {
    return NextResponse.json({ error: "Должность не найдена" }, { status: 404 });
  }

  const phone = normalizePhone(parsed.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "Неверный формат телефона. Пример: +7 985 123-45-67" },
      { status: 400 }
    );
  }

  // Согласовано с web-side /api/staff (manual add) и QR-join:
  // populate UserJournalAccess из JobPositionJournalAccess чтобы
  // новый cleaner НЕ видел медкнижки и пр. journal к которым его
  // должность не имеет доступа.
  const positionTemplates = await db.jobPositionJournalAccess.findMany({
    where: { organizationId: orgId, jobPositionId: position.id },
    include: { template: { select: { code: true } } },
  });
  const useStrictAcl = positionTemplates.length > 0;

  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: syntheticEmail(orgId),
        name: parsed.fullName,
        phone,
        passwordHash: "",
        role: deriveRoleFromCategory(position.categoryKey),
        positionTitle: position.name,
        jobPositionId: position.id,
        organizationId: orgId,
        isActive: true,
        journalAccessMigrated: useStrictAcl,
      },
      select: { id: true, name: true, jobPositionId: true, isActive: true },
    });
    if (useStrictAcl) {
      await tx.userJournalAccess.createMany({
        data: positionTemplates.map((t) => ({
          userId: u.id,
          templateCode: t.template.code,
          canRead: true,
          canWrite: true,
          canFinalize: false,
        })),
        skipDuplicates: true,
      });
    }
    return u;
  });

  return NextResponse.json({ user });
}
