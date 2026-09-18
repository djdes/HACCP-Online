// enable: временно включает incoming_control и cleaning_ventilation_checklist в тестовой организации; restore — возвращает.
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
const ORG = "cmoe6rpt4000097ts71yb922y";
const CODES = ["incoming_control", "cleaning_ventilation_checklist"];
const STATE = path.resolve(process.cwd(), ".agent/tasks/journal-time-edit-2026-09/e2e/org-disabled-backup.json");
async function main() {
  const mode = process.argv[2];
  const org = await db.organization.findUniqueOrThrow({ where: { id: ORG }, select: { disabledJournalCodes: true } });
  const current = org.disabledJournalCodes as string[];
  if (mode === "enable") {
    fs.writeFileSync(STATE, JSON.stringify(current));
    await db.organization.update({ where: { id: ORG }, data: { disabledJournalCodes: current.filter((c) => !CODES.includes(c)) } });
    console.log("enabled", CODES.join(","));
  } else if (mode === "restore") {
    const original = JSON.parse(fs.readFileSync(STATE, "utf8")) as string[];
    await db.organization.update({ where: { id: ORG }, data: { disabledJournalCodes: original } });
    console.log("restored", original.length);
  } else console.log("current:", JSON.stringify(current));
  await db.$disconnect();
}
main();
