import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isManagementRole } from "@/lib/user-roles";
import { notifyManagement } from "@/lib/notifications";
import { normalizePhone } from "@/lib/phone";
import { tryAutolinkTasksflowByPhone } from "@/lib/tasksflow-autolink";

/**
 * Minimal "add an employee" endpoint matching the reference-staff screen:
 * just Position + full name — no email invite here. We still create a `User`
 * row (everything downstream of hygiene / journals keys on userId), so:
 * - `isActive: true` — the employee is actively on staff and has to appear
 *   in every journal's employee selector (those selectors filter on
 *   isActive). Login is gated by a non-empty bcrypt hash, which we leave
 *   empty here, so no login is possible.
 * - empty passwordHash — bcrypt.compare against "" always returns false,
 *   locking logins cleanly. If the owner later wants the employee in the
 *   system as a real account, the existing POST /api/users/invite flow
 *   issues a token and writes a real hash.
 * - synthetic unique email — the @unique constraint on User.email stays
 *   satisfied without the owner having to think about addresses.
 */

const createSchema = z.object({
  jobPositionId: z.string().min(1, "Выберите должность"),
  fullName: z
    .string()
    .trim()
    .min(2, "ФИО слишком короткое")
    .max(200, "ФИО слишком длинное"),
  phone: z
    .string()
    .trim()
    .min(1, "Укажите телефон — без него не связать с TasksFlow"),
});

function forbidden() {
  return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
}

function syntheticEmail(orgId: string) {
  const salt = crypto.randomBytes(6).toString("hex");
  return `staff-${salt}@${orgId}.local.haccp`;
}

function deriveRoleFromCategory(categoryKey: string): string {
  return categoryKey === "management" ? "manager" : "cook";
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!isManagementRole(session.user.role) && !session.user.isRoot) {
    return forbidden();
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
    return NextResponse.json(
      { error: "Должность не найдена" },
      { status: 404 }
    );
  }

  const phone = normalizePhone(parsed.phone);
  if (!phone) {
    return NextResponse.json(
      {
        error:
          "Неверный формат телефона. Пример: +7 985 123-45-67",
      },
      { status: 400 }
    );
  }

  // Подтягиваем journals разрешённые для chosen position. Раньше:
  // journalAccessMigrated=false → hasJournalAccess возвращал true
  // для ВСЕХ журналов (back-compat path) → новый cleaner видел
  // mеджурналы (med_books) с ФИО всех сотрудников. Теперь как
  // QR-join (f0e90e24): ACL=migrated + populate UserJournalAccess
  // из JobPositionJournalAccess.
  const positionTemplates = await db.jobPositionJournalAccess.findMany({
    where: {
      organizationId: orgId,
      jobPositionId: position.id,
    },
    include: { template: { select: { code: true } } },
  });
  // Если в org нет JobPositionJournalAccess вообще — fallback на
  // legacy back-compat (журналы видны всем).
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
        // Active on staff from the first day — journals filter their employee
        // selectors on isActive, so we must start in the active set. Login
        // stays impossible while passwordHash is empty.
        isActive: true,
        // Если есть position-based ACL — переключаем юзера в migrated-режим.
        // Иначе остаёмся в legacy back-compat (full access).
        journalAccessMigrated: useStrictAcl,
      },
      select: {
        id: true,
        name: true,
        jobPositionId: true,
        isActive: true,
      },
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

  // Best-effort: if this org has an enabled TasksFlow integration and
  // a TF user with the matching phone already exists, create the link
  // right away. Silent on failure — owner can still link manually via
  // the staff page.
  tryAutolinkTasksflowByPhone({
    organizationId: orgId,
    weSetupUserId: user.id,
    phone,
    name: user.name,
  }).catch((err) => {
    console.error("[staff] tasksflow autolink failed", err);
  });

  // Surface the new hire in the bell panel — managers see it on next refresh
  // and can navigate straight to the journals they need to populate.
  const displayLabel = position.name
    ? `${user.name}, ${position.name}`
    : user.name;
  const journalsToPopulate: Array<{
    href: string;
    title: string;
    dedupeKey: string;
  }> = [
    {
      href: "/journals/hygiene",
      title: "Список фамилий, которые нужно внести в",
      dedupeKey: "staff.added.journal:hygiene",
    },
    {
      href: "/journals/health_check",
      title: "Список фамилий, которые нужно внести в",
      dedupeKey: "staff.added.journal:health_check",
    },
    {
      href: "/journals/staff_training",
      title: "Список фамилий, которые нужно внести в",
      dedupeKey: "staff.added.journal:staff_training",
    },
  ];
  const staticLinkLabels: Record<string, string> = {
    "/journals/hygiene": "гигиенический журнал",
    "/journals/health_check": "журнал здоровья",
    "/journals/staff_training": "журнал регистрации инструктажей",
  };
  try {
    await Promise.all(
      journalsToPopulate.map((j) =>
        notifyManagement({
          organizationId: orgId,
          kind: "staff.added.journal",
          dedupeKey: j.dedupeKey,
          title: j.title,
          linkHref: j.href,
          linkLabel: staticLinkLabels[j.href] ?? "журнал",
          items: [
            {
              id: user.id,
              label: displayLabel,
            },
          ],
        })
      )
    );
    // Plus one org-wide reminder for the training plan when a new position
    // shows up (we dedupe by position id, so re-hiring into the same
    // position doesn't create noise).
    await notifyManagement({
      organizationId: orgId,
      kind: "position.missing.trainingPlan",
      dedupeKey: `position.missing.trainingPlan:${position.id}`,
      title: "Список должностей, которые нужно внести в",
      linkHref: "/journals/training_plan",
      linkLabel: "план обучения",
      items: [
        {
          id: position.id,
          label: position.name,
        },
      ],
    });
  } catch (err) {
    console.error("[notifications] staff-create fanout failed", err);
  }

  return NextResponse.json({ user });
}
