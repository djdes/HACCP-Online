import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRoot } from "@/lib/auth-helpers";
import {
  computeAutoJournalCodes,
  computeDisabledJournalCodes,
  getDemoStaffForType,
  getOnboardingPreset,
  type OrgType,
} from "@/lib/onboarding-presets";
import { recordAuditLog } from "@/lib/audit-log";

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
 *   1. Создаёт Organization (type=restaurant по умолчанию).
 *   2. Применяет онбординг-пресет: positions + journal access +
 *      disabledJournalCodes + autoJournalCodes (как обычная компания
 *      получает через wizard).
 *   3. Заводит owner-пользователя `demo-{slug}@wesetup.local`
 *      с фиксированным паролем (для ROOT impersonation — на проде
 *      под него никто не входит).
 *   4. Заселяет демо-сотрудников через getDemoStaffForType (10-20 чел).
 *   5. Создаёт JournalDocument на текущий месяц для всех autoJournals.
 *   6. Заполняет JournalDocumentEntry rows за последние 7 дней с
 *      реалистичными значениями + jitter по времени.
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

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function todayStr() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Returns plausible per-template entry data. Keeps it simple and
 *  template-aware for the few high-traffic journals; everything else
 *  gets a generic "filled" marker. */
function generateEntryData(
  templateCode: string,
  jitterSeed: number
): Record<string, unknown> {
  const rand = (min: number, max: number) =>
    min + (max - min) * (Math.sin(jitterSeed * 12.9898) * 43758.5453 - Math.floor(Math.sin(jitterSeed * 12.9898) * 43758.5453));
  switch (templateCode) {
    case "hygiene":
      return {
        status: "healthy",
        temperatureAbove37: false,
      };
    case "health_check":
      return {
        status: "healthy",
        skinCondition: "normal",
        notes: "",
      };
    case "cold_equipment_control":
      // Generic — server-side temperature populated through Equipment
      // sensor mapping in real life. For demo, write a stub data object;
      // compliance считает по entry-existence, не по temperatures count
      // в relaxed-mode (см. today-compliance.ts).
      return {
        notes: "Замер выполнен",
        markedAt: new Date().toISOString(),
      };
    case "cleaning":
      return {
        completed: true,
        notes: "По регламенту",
      };
    case "fryer_oil":
      return {
        condition: "good",
        polarity: Math.round((10 + rand(0, 8)) * 10) / 10,
        replaced: false,
      };
    case "intensive_cooling":
      return {
        dishName: "Демо-блюдо",
        startTemperature: Math.round((75 + rand(0, 8)) * 10) / 10,
        endTemperature: Math.round((4 + rand(0, 2)) * 10) / 10,
      };
    default:
      return { completed: true };
  }
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
  const preset = getOnboardingPreset(orgType);

  const t0 = Date.now();

  // 1. Org
  const slug = `demo-${Date.now().toString(36)}`;
  const org = await db.organization.create({
    data: {
      name: orgName,
      type: orgType,
      subscriptionPlan: "trial",
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

  // 3. Apply preset positions + journal access (idempotent within new org).
  const positionByName = new Map<string, string>();
  let sortOrder = 0;
  for (const pos of preset.positions) {
    const created = await db.jobPosition.create({
      data: {
        organizationId: org.id,
        categoryKey: pos.category,
        name: pos.name,
        sortOrder: sortOrder++,
      },
      select: { id: true },
    });
    positionByName.set(pos.name, created.id);
  }
  const allCodes = Array.from(
    new Set(preset.positions.flatMap((p) => p.journalCodes))
  );
  const templates = await db.journalTemplate.findMany({
    where: { code: { in: allCodes } },
    select: { id: true, code: true, name: true },
  });
  const tplByCode = new Map(templates.map((t) => [t.code, t.id]));
  const tplNameByCode = new Map(templates.map((t) => [t.code, t.name]));
  for (const pos of preset.positions) {
    const positionId = positionByName.get(pos.name);
    if (!positionId) continue;
    const ids = pos.journalCodes
      .map((c) => tplByCode.get(c))
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) continue;
    await db.jobPositionJournalAccess.createMany({
      data: ids.map((templateId) => ({
        organizationId: org.id,
        jobPositionId: positionId,
        templateId,
      })),
      skipDuplicates: true,
    });
  }

  // Bind owner to "Управляющий"-style position if present.
  const managerPosId =
    positionByName.get("Управляющий") ??
    positionByName.get("Директор производства") ??
    null;
  if (managerPosId) {
    await db.user.update({
      where: { id: owner.id },
      data: { jobPositionId: managerPosId },
    });
  }

  // 4. Demo staff.
  const demoStaff = getDemoStaffForType(orgType);
  const staffByPosition = new Map<string, { id: string; name: string }[]>();
  for (const s of demoStaff) {
    const positionId = positionByName.get(s.positionName);
    if (!positionId) continue;
    const created = await db.user.create({
      data: {
        organizationId: org.id,
        name: s.fullName,
        email: `${slug}-${s.phone.replace(/\D/g, "")}@wesetup.local`,
        passwordHash: "",
        role: "cook",
        phone: s.phone,
        jobPositionId: positionId,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    const list = staffByPosition.get(positionId) ?? [];
    list.push({ id: created.id, name: created.name });
    staffByPosition.set(positionId, list);
  }

  // Pool of all employees (incl. owner) for entry attribution.
  const allEmployees: Array<{ id: string; name: string }> = [
    { id: owner.id, name: owner.name },
    ...[...staffByPosition.values()].flat(),
  ];

  // 5. Auto-journal documents — текущий месяц.
  const monthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)
  );
  monthEnd.setUTCHours(23, 59, 59, 999);
  const autoCodes = computeAutoJournalCodes(preset);
  const docByTemplateId = new Map<string, string>();
  for (const code of autoCodes) {
    const templateId = tplByCode.get(code);
    if (!templateId) continue;
    const tplName = tplNameByCode.get(code) ?? code;
    const doc = await db.journalDocument.create({
      data: {
        organizationId: org.id,
        templateId,
        title: `${tplName} (демо)`,
        dateFrom: monthStart,
        dateTo: monthEnd,
        status: "active",
        autoFill: true,
        config: {} as Prisma.InputJsonValue,
        createdById: owner.id,
      },
      select: { id: true },
    });
    docByTemplateId.set(templateId, doc.id);
  }

  // 6. Заполняем последние N дней. Для каждого активного документа —
  // 70-100% rosters в каждый день, чтобы дашборд показывал «зелёный»
  // compliance с реалистичным jitter'ом.
  let entriesCreated = 0;
  const today = utcDayStart(new Date());
  for (let i = 1; i <= days; i++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - i);

    for (const [templateId, documentId] of docByTemplateId.entries()) {
      const tplCode = templates.find((t) => t.id === templateId)?.code ?? "";
      // Roster — все сотрудники для hygiene/health_check, иначе случайный
      // подмножество чтобы compliance был не 100%.
      const roster =
        tplCode === "hygiene" || tplCode === "health_check"
          ? allEmployees
          : allEmployees.filter((_, idx) => (idx + i) % 3 !== 2);

      for (const emp of roster) {
        try {
          await db.journalDocumentEntry.create({
            data: {
              documentId,
              employeeId: emp.id,
              date: day,
              data: generateEntryData(
                tplCode,
                emp.id.charCodeAt(0) + i
              ) as Prisma.InputJsonValue,
            },
          });
          entriesCreated += 1;
        } catch {
          // duplicate — пропускаем (повторный seed на тот же день)
        }
      }
    }
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
      positionsCreated: positionByName.size,
      staffCreated: demoStaff.length,
      documentsCreated: docByTemplateId.size,
      entriesCreated,
      durationMs: Date.now() - t0,
    },
  });

  return NextResponse.json({
    ok: true,
    organizationId: org.id,
    name: org.name,
    ownerEmail,
    positionsCreated: positionByName.size,
    staffCreated: demoStaff.length,
    documentsCreated: docByTemplateId.size,
    entriesCreated,
    durationMs: Date.now() - t0,
  });
}
