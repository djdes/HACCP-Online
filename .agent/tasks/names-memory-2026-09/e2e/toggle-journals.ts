// enable: временно включает четыре журнала в тестовой организации; restore — возвращает список.
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
const ORG = "cmoe6rpt4000097ts71yb922y";
const CODES = ["finished_product", "perishable_rejection", "incoming_control", "intensive_cooling"];
const STATE = path.resolve(process.cwd(), ".agent/tasks/names-memory-2026-09/e2e/org-disabled-backup.json");
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
  } else if (mode === "cleanup-names") {
    const r = await db.nameSuggestion.deleteMany({ where: { organizationId: ORG, value: { startsWith: "E2E " } } });
    console.log("deleted suggestions", r.count);
    // Тестовые строки: «E2E …» в бракераже/скоропорте и пустые блюда в охлаждении.
    const docs = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), ".agent/tasks/names-memory-2026-09/e2e/docs.json"), "utf8")) as Record<string, { id: string } | null>;
    for (const [code, doc] of Object.entries(docs)) {
      if (!doc) continue;
      const row = await db.journalDocument.findUnique({ where: { id: doc.id }, select: { config: true } });
      const cfg = (row?.config ?? {}) as { rows?: Array<Record<string, unknown>> };
      if (!Array.isArray(cfg.rows)) continue;
      const before = cfg.rows.length;
      cfg.rows = cfg.rows.filter((r) => {
        const name = String(r.productName ?? r.dishName ?? "");
        if (name.startsWith("E2E ")) return false;
        if (code === "intensive_cooling" && name.trim() === "") return false;
        return true;
      });
      if (cfg.rows.length !== before) {
        await db.journalDocument.update({ where: { id: doc.id }, data: { config: cfg as object } });
        console.log(code, "rows removed:", before - cfg.rows.length);
      }
    }
  } else console.log("current:", JSON.stringify(current));
  await db.$disconnect();
}
main();
