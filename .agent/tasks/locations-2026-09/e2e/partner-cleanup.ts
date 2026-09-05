/* eslint-disable no-console */
// Откат партнёрского сида: документы и точки, созданные тестовым партнёром,
// а с --full — сам партнёр, его пользователь и его организация.
import fs from "node:fs";
import { db } from "@/lib/db";

const p = JSON.parse(fs.readFileSync(".agent/tasks/locations-2026-09/e2e/creds.json", "utf8")) as {
  userId: string; partnerOrgId: string; partnerId: string; clientOrgId: string;
};
const FULL = process.argv.includes("--full");
const STRAY_NAMES = ["Партнёрская точка", "Партнёрская точка 2", "Партнёрская точка 3"];

async function main() {
  const docs = await db.journalDocument.deleteMany({ where: { createdById: p.userId } });
  const strayBuildings = await db.building.deleteMany({
    where: { organizationId: { in: [p.clientOrgId, p.partnerOrgId] }, name: { in: STRAY_NAMES } },
  });
  console.log({ docsByPartner: docs.count, strayBuildings: strayBuildings.count });
  if (FULL) {
    await db.partner.delete({ where: { id: p.partnerId } }).catch(() => {});
    await db.user.delete({ where: { id: p.userId } }).catch(() => {});
    await db.organization.delete({ where: { id: p.partnerOrgId } }).catch(() => {});
    console.log("partner, user and org removed");
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
