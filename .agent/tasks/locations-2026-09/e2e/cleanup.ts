/* eslint-disable no-console */
// Откат сида: документы, точки, флаг организации, точки у e2e-пользователя.
//   node --env-file=.env.local --import tsx .agent/tasks/locations-2026-09/e2e/cleanup.ts
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

const STATE = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09/e2e/state.json");
const CREDS = path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json");

async function main() {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8")) as {
    org: string; prevFlag: boolean; buildingA: string; buildingB: string; docA: string; docB: string;
  };
  const creds = JSON.parse(fs.readFileSync(CREDS, "utf8")) as { id: string };
  const buildingIds = [state.buildingA, state.buildingB];

  const docs = await db.journalDocument.deleteMany({
    where: { organizationId: state.org, OR: [{ id: { in: [state.docA, state.docB] } }, { buildingId: { in: buildingIds } }] },
  });
  const obligations = await db.journalObligation.deleteMany({ where: { buildingId: { in: buildingIds } } });
  await db.user.update({ where: { id: creds.id }, data: { buildingIds: [] } }).catch(() => {});
  const buildings = await db.building.deleteMany({ where: { id: { in: buildingIds }, organizationId: state.org } });
  await db.organization.update({ where: { id: state.org }, data: { perLocationJournals: state.prevFlag } });
  console.log({ docs: docs.count, obligations: obligations.count, buildings: buildings.count, flagRestored: state.prevFlag });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
