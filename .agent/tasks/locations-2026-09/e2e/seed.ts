/* eslint-disable no-console */
// Две точки + по документу гигиены на каждую для e2e-организации.
//   node --env-file=.env.local --import tsx .agent/tasks/locations-2026-09/e2e/seed.ts
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

const ORG = process.env.E2E_ORG ?? "cmoe6rpt4000097ts71yb922y";
const OUT = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09/e2e/state.json");

async function main() {
  const org = await db.organization.findUnique({
    where: { id: ORG },
    select: { id: true, name: true, perLocationJournals: true },
  });
  if (!org) throw new Error(`org not found: ${ORG}`);

  const template = await db.journalTemplate.findUnique({ where: { code: "hygiene" }, select: { id: true } });
  if (!template) throw new Error("hygiene template not found");

  async function ensureBuilding(name: string, address: string | null, sortOrder: number) {
    const existing = await db.building.findFirst({ where: { organizationId: ORG, name }, select: { id: true } });
    if (existing) return existing.id;
    const created = await db.building.create({
      data: { organizationId: ORG, name, address, sortOrder },
      select: { id: true },
    });
    return created.id;
  }
  const buildingA = await ensureBuilding("E2E Точка А", "ул. Ленина, 5", 100);
  const buildingB = await ensureBuilding("E2E Точка Б", null, 101);

  await db.organization.update({ where: { id: ORG }, data: { perLocationJournals: true } });

  const today = new Date();
  const dateFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const dateTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 14));
  async function ensureDoc(title: string, buildingId: string) {
    const existing = await db.journalDocument.findFirst({ where: { organizationId: ORG, title }, select: { id: true } });
    if (existing) return existing.id;
    const created = await db.journalDocument.create({
      data: { organizationId: ORG, templateId: template!.id, title, buildingId, dateFrom, dateTo, status: "active" },
      select: { id: true },
    });
    return created.id;
  }
  const docA = await ensureDoc("E2E точка А", buildingA);
  const docB = await ensureDoc("E2E точка Б", buildingB);

  const allBuildings = await db.building.findMany({
    where: { organizationId: ORG },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const state = { org: ORG, prevFlag: org.perLocationJournals, buildingA, buildingB, docA, docB, allBuildings };
  fs.writeFileSync(OUT, JSON.stringify(state, null, 2));
  console.log(JSON.stringify(state, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
