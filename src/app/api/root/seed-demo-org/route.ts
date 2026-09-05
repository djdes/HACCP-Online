import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireRoot } from "@/lib/auth-helpers";
import {
  computeAutoJournalCodes,
  computeDisabledJournalCodes,
  getOnboardingPreset,
  type OrgType,
} from "@/lib/onboarding-presets";
import { recordAuditLog } from "@/lib/audit-log";
import { sphereToPreset } from "@/lib/org-profile";
import { attachAccountForNewOrganization } from "@/lib/create-organization";
import { seedDemoOrganizationData } from "@/lib/demo-organization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/root/seed-demo-org
 *
 * One-click создание полноценной демо-организации с историей за 7 дней.
 * Цель: ROOT'у показать продажникам / новому покупателю «как это
 * выглядит когда уже работает», вместо пустого дашборда.
 *
 * Что делает:
 *   1. Создаёт Organization (type=restaurant по умолчанию) с
 *      disabledJournalCodes + autoJournalCodes пресета.
 *   2. Заводит owner-пользователя `demo-{slug}@wesetup.local`
 *      с фиксированным паролем (для ROOT impersonation — на проде
 *      под него никто не входит) и аккаунт.
 *   3. Заселяет через общий `seedDemoOrganizationData` (тот же, что у
 *      пользовательской кнопки «Посмотреть на демо-данных»): должности,
 *      demo-сотрудники, JournalDocument на месяц, записи за N дней.
 *
 * Идемпотентно частично: повторный POST с тем же `name` создаст
 * новую org (мы не хотим обновлять существующую). Вызывающий должен
 * сам убедиться что не плодит дубли.
 *
 * Body:
 *   { name?: string, type?: OrgType, daysOfHistory?: number }
 */
const bodySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  type: z
    .enum(["restaurant", "meat", "dairy", "bakery", "confectionery", "other"])
    .optional(),
  daysOfHistory: z.number().int().min(1).max(30).optional(),
});

function todayStr() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  await requireRoot();

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad body" },
        { status: 400 }
      );
    }
    throw err;
  }

  const orgType = (parsed.type ?? "restaurant") as OrgType;
  const orgName = parsed.name ?? `Демо ресторан ${todayStr()}`;
  const days = parsed.daysOfHistory ?? 7;
  const preset = getOnboardingPreset(sphereToPreset(orgType));

  const t0 = Date.now();

  // 1. Org
  const slug = `demo-${Date.now().toString(36)}`;
  const org = await db.organization.create({
    data: {
      name: orgName,
      type: orgType,
      subscriptionPlan: "free",
      disabledJournalCodes: computeDisabledJournalCodes(preset),
      autoJournalCodes: computeAutoJournalCodes(preset),
    },
    select: { id: true, name: true },
  });

  // 2. Owner user (fixed password — для ROOT impersonate-as flow,
  // никто на проде не должен логиниться этим паролем).
  const ownerEmail = `${slug}@wesetup.local`;
  const ownerPasswordHash = await bcrypt.hash(`demo-pass-${slug}`, 10);
  const owner = await db.user.create({
    data: {
      email: ownerEmail,
      name: "Демо Управляющий",
      role: "manager",
      passwordHash: ownerPasswordHash,
      organizationId: org.id,
      isActive: true,
    },
    select: { id: true, name: true },
  });

  // Демо-организация тоже получает аккаунт: иначе ROOT'овская песочница
  // ведёт себя не так, как боевая регистрация, и баги multi-org на ней
  // не воспроизводятся.
  await attachAccountForNewOrganization(db, {
    ownerUserId: owner.id,
    organizationId: org.id,
    subscriptionPlan: "free",
  });

  // 3. Должности, сотрудники, документы, записи — общий сидер.
  const seed = await seedDemoOrganizationData({
    organizationId: org.id,
    sphere: orgType,
    createdById: owner.id,
    extraEmployees: [{ id: owner.id, name: owner.name }],
    daysOfHistory: days,
  });

  // Bind owner to "Управляющий"-style position if present.
  const managerPositions = await db.jobPosition.findMany({
    where: {
      organizationId: org.id,
      name: { in: ["Управляющий", "Директор производства"] },
    },
    select: { id: true, name: true },
  });
  const managerPos =
    managerPositions.find((p) => p.name === "Управляющий") ??
    managerPositions[0] ??
    null;
  if (managerPos) {
    await db.user.update({
      where: { id: owner.id },
      data: { jobPositionId: managerPos.id },
    });
  }

  await recordAuditLog({
    request,
    organizationId: org.id,
    action: "root.seed-demo-org",
    entity: "Organization",
    entityId: org.id,
    details: {
      orgName,
      orgType,
      daysOfHistory: days,
      ...seed,
      durationMs: Date.now() - t0,
    },
  });

  return NextResponse.json({
    ok: true,
    organizationId: org.id,
    name: org.name,
    ownerEmail,
    ...seed,
    durationMs: Date.now() - t0,
  });
}
