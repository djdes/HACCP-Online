/* eslint-disable no-console */
// snapshot: сохранить config + entries документа климата; restore: вернуть; check: показать текущее.
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const CLIMATE_DOC = "cmt6j45ne0hy482ts2ii5wkkd";
const STATE = path.resolve(process.cwd(), ".agent/tasks/journal-time-edit-2026-09/e2e/climate-snapshot.json");

async function main() {
  const mode = process.argv[2];
  if (mode === "snapshot") {
    const doc = await db.journalDocument.findUniqueOrThrow({
      where: { id: CLIMATE_DOC },
      select: { config: true, entries: { select: { id: true, data: true } } },
    });
    fs.writeFileSync(STATE, JSON.stringify(doc, null, 2));
    console.log("snapshot entries:", doc.entries.length);
  } else if (mode === "restore") {
    const saved = JSON.parse(fs.readFileSync(STATE, "utf8")) as {
      config: unknown;
      entries: Array<{ id: string; data: unknown }>;
    };
    const asJson = (v: unknown) => (v === null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));
    await db.journalDocument.update({ where: { id: CLIMATE_DOC }, data: { config: asJson(saved.config) } });
    for (const entry of saved.entries) {
      await db.journalDocumentEntry.update({ where: { id: entry.id }, data: { data: asJson(entry.data) } });
    }
    // Записи, созданные проверкой (их нет в снимке) — удалить.
    const known = new Set(saved.entries.map((e) => e.id));
    const extra = await db.journalDocumentEntry.findMany({ where: { documentId: CLIMATE_DOC }, select: { id: true } });
    const toDelete = extra.filter((e) => !known.has(e.id)).map((e) => e.id);
    if (toDelete.length) await db.journalDocumentEntry.deleteMany({ where: { id: { in: toDelete } } });
    console.log("restored; deleted extra:", toDelete.length);
  } else {
    const doc = await db.journalDocument.findUniqueOrThrow({
      where: { id: CLIMATE_DOC },
      select: { config: true, entries: { select: { date: true, data: true }, orderBy: { date: "asc" } } },
    });
    const cfg = doc.config as { controlTimes?: string[] };
    console.log("controlTimes:", JSON.stringify(cfg.controlTimes));
    for (const e of doc.entries) {
      const m = (e.data as { measurements?: Record<string, Record<string, unknown>> }).measurements ?? {};
      const filled = Object.entries(m).flatMap(([room, byTime]) =>
        Object.entries(byTime).filter(([, v]) => (v as { temperature: unknown }).temperature != null).map(([t, v]) => `${room}@${t}=${JSON.stringify(v)}`)
      );
      if (filled.length) console.log(e.date.toISOString().slice(0, 10), filled.join(" | "));
    }
  }
  await db.$disconnect();
}
main();
