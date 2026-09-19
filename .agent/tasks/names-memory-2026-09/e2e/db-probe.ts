import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
const ORG = "cmoe6rpt4000097ts71yb922y";
(async () => {
  const org = await db.organization.findUniqueOrThrow({ where: { id: ORG }, select: { disabledJournalCodes: true } });
  const codes = org.disabledJournalCodes as string[];
  const out: Record<string, { id: string; title: string } | null> = {};
  for (const code of ["finished_product", "perishable_rejection", "incoming_control", "intensive_cooling"]) {
    const doc = await db.journalDocument.findFirst({ where: { organizationId: ORG, status: "active", template: { code } }, select: { id: true, title: true }, orderBy: { dateFrom: "desc" } });
    out[code] = doc;
    console.log(code, "disabled=", codes.includes(code), JSON.stringify(doc));
  }
  fs.writeFileSync(path.resolve(process.cwd(), ".agent/tasks/names-memory-2026-09/e2e/docs.json"), JSON.stringify(out, null, 2));
  const n = await db.nameSuggestion.count({ where: { organizationId: ORG } });
  console.log("nameSuggestion rows:", n);
  await db.$disconnect();
})();
