// Стенд: организации A (реальная) и B (чужая), ROOT, справочники A.
// Запуск: npx tsx .agent/tasks/journal-responsibles-org-2026-09/e2e/setup-db.ts
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

import { db } from "./db";

export const PASSWORD = "E2eTest2026!";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

async function upsertOrg(id: string, name: string) {
  return db.organization.upsert({
    where: { id },
    update: { name, isDemo: false, journalResponsibleUsersJson: {}, autoJournalCodes: [] },
    create: {
      id,
      name,
      type: "restaurant",
      phone: "+79990000000",
      subscriptionPlan: "pro",
      subscriptionEnd: new Date(Date.now() + 365 * 86400_000),
      isDemo: false,
    },
  });
}

async function upsertPosition(organizationId: string, name: string, categoryKey: "management" | "staff") {
  const existing = await db.jobPosition.findFirst({ where: { organizationId, name } });
  if (existing) return existing;
  return db.jobPosition.create({ data: { organizationId, name, categoryKey } });
}

async function upsertUser(input: {
  email: string;
  name: string;
  role: string;
  organizationId: string;
  jobPositionId?: string | null;
  positionTitle?: string | null;
  isActive?: boolean;
  archivedAt?: Date | null;
  isRoot?: boolean;
  passwordHash: string;
}) {
  const data = {
    name: input.name,
    role: input.role,
    organizationId: input.organizationId,
    jobPositionId: input.jobPositionId ?? null,
    positionTitle: input.positionTitle ?? null,
    isActive: input.isActive ?? true,
    archivedAt: input.archivedAt ?? null,
    isRoot: input.isRoot ?? false,
    passwordHash: input.passwordHash,
    phone: "+79990000001",
  };
  return db.user.upsert({
    where: { email: input.email },
    update: data,
    create: { email: input.email, ...data },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Чистый старт: документы орг A/B пересоздаются каждым прогоном.
  await db.journalDocument.deleteMany({ where: { organizationId: { in: ["e2e-org-a", "e2e-org-b"] } } });

  const orgA = await upsertOrg("e2e-org-a", "Кафе «Альфа»");
  const orgB = await upsertOrg("e2e-org-b", "Столовая «Бета»");

  const posManager = await upsertPosition(orgA.id, "Управляющий", "management");
  const posHead = await upsertPosition(orgA.id, "Заведующая производством", "management");
  const posCook = await upsertPosition(orgA.id, "Повар", "staff");
  const posCleaner = await upsertPosition(orgA.id, "Уборщица", "staff");
  const posCookB = await upsertPosition(orgB.id, "Повар", "staff");

  const users = {
    managerA: await upsertUser({ email: "manager-a@e2e.local", name: "Мария Руководитель", role: "manager", organizationId: orgA.id, jobPositionId: posManager.id, passwordHash }),
    ownerA: await upsertUser({ email: "owner-a@e2e.local", name: "owner-a@e2e.local", role: "owner", organizationId: orgA.id, passwordHash }),
    headA: await upsertUser({ email: "head-a@e2e.local", name: "Анна Заведующая", role: "head_chef", organizationId: orgA.id, jobPositionId: posHead.id, passwordHash }),
    cookA: await upsertUser({ email: "cook-a@e2e.local", name: "Иван Повар", role: "cook", organizationId: orgA.id, jobPositionId: posCook.id, passwordHash }),
    cleanerA: await upsertUser({ email: "cleaner-a@e2e.local", name: "Ольга Уборщица", role: "cook", organizationId: orgA.id, jobPositionId: posCleaner.id, passwordHash }),
    archivedA: await upsertUser({ email: "archived-a@e2e.local", name: "Архивный Сотрудник", role: "cook", organizationId: orgA.id, jobPositionId: posCook.id, isActive: false, archivedAt: new Date(), passwordHash }),
    managerB: await upsertUser({ email: "manager-b@e2e.local", name: "Пётр Чужой", role: "manager", organizationId: orgB.id, passwordHash }),
    cookB: await upsertUser({ email: "cook-b@e2e.local", name: "Семён Чужой", role: "cook", organizationId: orgB.id, jobPositionId: posCookB.id, passwordHash }),
  };

  const root = await db.user.findFirst({ where: { isRoot: true }, select: { id: true, email: true } });
  if (!root) throw new Error("В e2e-базе нет ROOT — прогоните prisma/seed.ts");
  await db.user.update({ where: { id: root.id }, data: { passwordHash } });

  // Справочники A: датчик (не холодильник), продукты, поставщик в партии, помещение.
  const area = (await db.area.findFirst({ where: { organizationId: orgA.id, name: "Горячий цех" } }))
    ?? (await db.area.create({ data: { organizationId: orgA.id, name: "Горячий цех" } }));
  if (!(await db.equipment.findFirst({ where: { areaId: area.id } }))) {
    await db.equipment.create({ data: { areaId: area.id, name: "Термогигрометр цеха", type: "sensor" } });
  }
  for (const name of ["Сметана 20 %", "Творог 9 %"]) {
    if (!(await db.product.findFirst({ where: { organizationId: orgA.id, name } }))) {
      await db.product.create({ data: { organizationId: orgA.id, name } });
    }
  }
  await db.batch.upsert({
    where: { organizationId_code: { organizationId: orgA.id, code: "E2E-1" } },
    update: { supplier: "ООО «Молочный двор»" },
    create: { organizationId: orgA.id, code: "E2E-1", productName: "Сметана 20 %", supplier: "ООО «Молочный двор»", quantity: 5 },
  });
  const building = (await db.building.findFirst({ where: { organizationId: orgA.id } }))
    ?? (await db.building.create({ data: { organizationId: orgA.id, name: "Основная точка" } }));
  if (!(await db.room.findFirst({ where: { buildingId: building.id } }))) {
    await db.room.create({ data: { buildingId: building.id, name: "Склад сухих продуктов", kind: "storage" } });
  }

  const state = {
    password: PASSWORD,
    orgA: orgA.id,
    orgB: orgB.id,
    root: { id: root.id, email: root.email },
    users: Object.fromEntries(Object.entries(users).map(([key, user]) => [key, { id: user.id, email: user.email, name: user.name }])),
  };
  fs.writeFileSync(path.join(HERE, "state.json"), JSON.stringify(state, null, 2));
  console.log("OK", JSON.stringify(state.users, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
