/**
 * Сид-скрипт: заполнить config 9 журналов, у которых после
 * первого «Отправить всем» был skip из-за пустого config.
 *
 * Запуск: npx tsx prisma/seed-restaurant-configs.ts
 *
 * Ожидаемое поведение после прогонки:
 *   повторное «Отправить всем» в UI разложит ВСЕ 35 журналов
 *   на сотрудников.
 */

// dotenv может отсутствовать в node_modules (deploy minimizing) — грузим
// .env вручную, если он есть.
import fs from "node:fs";
import path from "node:path";
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
} catch {
  // не критично — если переменные уже в окружении PM2, всё работает
}
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  getDefaultEquipmentMaintenanceConfig,
} from "../src/lib/equipment-maintenance-document";
import {
  getDefaultEquipmentCalibrationConfig,
} from "../src/lib/equipment-calibration-document";
import {
  getSanitationDayDefaultConfig,
} from "../src/lib/sanitation-day-document";
import {
  getTrainingPlanDefaultConfig,
} from "../src/lib/training-plan-document";
import {
  getAuditPlanDefaultConfig,
} from "../src/lib/audit-plan-document";
import {
  getDefaultAuditProtocolConfig,
} from "../src/lib/audit-protocol-document";
import {
  getDefaultAuditReportConfig,
} from "../src/lib/audit-report-document";
import {
  getDefaultCleaningDocumentConfig,
  normalizeCleaningDocumentConfig,
} from "../src/lib/cleaning-document";
import {
  getDefaultGlassListConfig,
  createGlassListRow,
} from "../src/lib/glass-list-document";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ORG_NAME = "Ресторан «Вкусная Гавань»";

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
    select: { id: true },
  });
  if (!org) throw new Error("Org не найдена. Запустите сначала seed-restaurant.ts");

  // Подбираем нужных сотрудников по должности
  const users = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      jobPosition: { is: { name: { in: [
        "Управляющий", "Шеф-повар", "Технолог", "Уборщик", "Менеджер зала",
      ] } } },
    },
    include: { jobPosition: { select: { name: true } } },
  });
  const findByPos = (name: string) =>
    users.find((u) => u.jobPosition?.name === name);

  const admin = findByPos("Управляющий");
  const chef = findByPos("Шеф-повар");
  const tech = findByPos("Технолог");
  const cleaner = findByPos("Уборщик");
  if (!admin || !chef || !tech || !cleaner) {
    throw new Error("Не нашёл одного из ключевых юзеров (Управляющий/Шеф/Технолог/Уборщик)");
  }

  // Все документы организации
  const docs = await prisma.journalDocument.findMany({
    where: { organizationId: org.id, status: "active" },
    include: { template: { select: { code: true } } },
  });
  const findDoc = (code: string) => docs.find((d) => d.template.code === code);

  const updates: Array<{ code: string; ok: boolean; reason?: string }> = [];

  // 1. cleaning — нужен responsiblePairs (уборщик) + rooms
  {
    const doc = findDoc("cleaning");
    if (doc) {
      const baseDefault = getDefaultCleaningDocumentConfig();
      const config = normalizeCleaningDocumentConfig({
        ...baseDefault,
        responsiblePairs: [
          {
            id: "pair-main",
            cleaningTitle: "Уборщик",
            cleaningUserId: cleaner.id,
            cleaningUserName: cleaner.name,
            controlTitle: "Менеджер зала",
            controlUserId: findByPos("Менеджер зала")?.id ?? null,
            controlUserName: findByPos("Менеджер зала")?.name ?? "",
          },
        ],
      });
      await prisma.journalDocument.update({
        where: { id: doc.id },
        data: {
          config: config as object,
          responsibleUserId: cleaner.id,
          responsibleTitle: "Уборщик",
        },
      });
      updates.push({ code: "cleaning", ok: true });
    }
  }

  // 2. general_cleaning — sanitation_day config с responsibleEmployeeId
  {
    const doc = findDoc("general_cleaning");
    if (doc) {
      const cfg = getSanitationDayDefaultConfig();
      cfg.responsibleEmployeeId = cleaner.id;
      cfg.responsibleEmployee = cleaner.name;
      cfg.responsibleRole = "Уборщик";
      cfg.approveEmployeeId = admin.id;
      cfg.approveEmployee = admin.name;
      await prisma.journalDocument.update({
        where: { id: doc.id },
        data: {
          config: cfg as object,
          responsibleUserId: cleaner.id,
          responsibleTitle: "Уборщик",
        },
      });
      updates.push({ code: "general_cleaning", ok: true });
    }
  }

  // 3. training_plan
  {
    const doc = findDoc("training_plan");
    if (doc) {
      const cfg = getTrainingPlanDefaultConfig();
      // Тип TrainingPlanConfig имеет responsibleEmployeeId/approveEmployeeId
      const cfgAny = cfg as Record<string, unknown>;
      cfgAny.responsibleEmployeeId = admin.id;
      cfgAny.responsibleEmployee = admin.name;
      cfgAny.responsibleRole = "Управляющий";
      cfgAny.approveEmployeeId = admin.id;
      cfgAny.approveEmployee = admin.name;
      await prisma.journalDocument.update({
        where: { id: doc.id },
        data: {
          config: cfg as object,
          responsibleUserId: admin.id,
          responsibleTitle: "Управляющий",
        },
      });
      updates.push({ code: "training_plan", ok: true });
    }
  }

  // 4. equipment_maintenance — responsibleEmployeeId = Технолог
  {
    const doc = findDoc("equipment_maintenance");
    if (doc) {
      const cfg = getDefaultEquipmentMaintenanceConfig();
      cfg.responsibleEmployeeId = tech.id;
      cfg.responsibleEmployee = tech.name;
      cfg.responsibleRole = "Технолог";
      cfg.approveEmployeeId = admin.id;
      cfg.approveEmployee = admin.name;
      await prisma.journalDocument.update({
        where: { id: doc.id },
        data: {
          config: cfg as object,
          responsibleUserId: tech.id,
          responsibleTitle: "Технолог",
        },
      });
      updates.push({ code: "equipment_maintenance", ok: true });
    }
  }

  // 5. equipment_calibration
  {
    const doc = findDoc("equipment_calibration");
    if (doc) {
      const cfg = getDefaultEquipmentCalibrationConfig();
      const cfgAny = cfg as Record<string, unknown>;
      cfgAny.responsibleEmployeeId = tech.id;
      cfgAny.responsibleEmployee = tech.name;
      cfgAny.responsibleRole = "Технолог";
      cfgAny.approveEmployeeId = admin.id;
      cfgAny.approveEmployee = admin.name;
      await prisma.journalDocument.update({
        where: { id: doc.id },
        data: {
          config: cfg as object,
          responsibleUserId: tech.id,
          responsibleTitle: "Технолог",
        },
      });
      updates.push({ code: "equipment_calibration", ok: true });
    }
  }

  // 5b. glass_items_list — config с парой стеклянных изделий + responsibleUserId
  {
    const doc = findDoc("glass_items_list");
    if (doc) {
      const cfg = getDefaultGlassListConfig();
      cfg.responsibleUserId = tech.id;
      cfg.responsibleTitle = "Технолог";
      cfg.rows = [
        createGlassListRow({ location: "Бар", itemName: "Бокалы для вина", quantity: "24" }),
        createGlassListRow({ location: "Зал", itemName: "Графины", quantity: "8" }),
        createGlassListRow({ location: "Кухня", itemName: "Стеклянные банки для специй", quantity: "30" }),
      ];
      await prisma.journalDocument.update({
        where: { id: doc.id },
        data: {
          config: cfg as object,
          responsibleUserId: tech.id,
          responsibleTitle: "Технолог",
        },
      });
      updates.push({ code: "glass_items_list", ok: true });
    }
  }

  // 6-8. audit_*
  for (const [code, builder] of [
    ["audit_plan", () => getAuditPlanDefaultConfig()],
    ["audit_protocol", () => getDefaultAuditProtocolConfig()],
    ["audit_report", () => getDefaultAuditReportConfig()],
  ] as const) {
    const doc = findDoc(code);
    if (!doc) continue;
    const cfg = builder() as Record<string, unknown>;
    cfg.responsibleEmployeeId = admin.id;
    cfg.responsibleEmployee = admin.name;
    cfg.responsibleRole = "Управляющий";
    cfg.approveEmployeeId = admin.id;
    cfg.approveEmployee = admin.name;
    await prisma.journalDocument.update({
      where: { id: doc.id },
      data: {
        config: cfg as object,
        responsibleUserId: admin.id,
        responsibleTitle: "Управляющий",
      },
    });
    updates.push({ code, ok: true });
  }

  console.log("Готово. Обновлено документов:");
  for (const u of updates) {
    console.log(`  ${u.ok ? "✓" : "✗"} ${u.code}${u.reason ? " — " + u.reason : ""}`);
  }
  console.log(
    "\nТеперь нажмите «Отправить всем на заполнение» — задачи разложатся по всем 35 журналам."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
