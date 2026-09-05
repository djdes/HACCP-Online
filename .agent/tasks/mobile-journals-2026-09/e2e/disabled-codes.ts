/* eslint-disable no-console */
// Сохранить и очистить disabledJournalCodes тестовой организации на время обхода; --restore вернёт.
import { db } from "../../../../src/lib/db";
import fs from "node:fs";
const ORG = "cmoe6rpt4000097ts71yb922y";
const FILE = ".agent/tasks/mobile-journals-2026-09/e2e/disabled-codes.json";
(async () => {
  if (process.argv.includes("--restore")) {
    const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
    await db.organization.update({ where: { id: ORG }, data: { disabledJournalCodes: saved } });
    console.log("restored", JSON.stringify(saved));
  } else {
    const org = await db.organization.findUnique({ where: { id: ORG }, select: { disabledJournalCodes: true } });
    fs.writeFileSync(FILE, JSON.stringify(org?.disabledJournalCodes ?? []));
    await db.organization.update({ where: { id: ORG }, data: { disabledJournalCodes: [] } });
    console.log("saved+cleared", JSON.stringify(org?.disabledJournalCodes));
  }
  await db.$disconnect();
})();
