/* eslint-disable no-console */
import { db } from "../../../../src/lib/db";
import fs from "node:fs";
const ORG = "cmoe6rpt4000097ts71yb922y";
(async () => {
  const doc = await db.paperJournalDocument.create({
    data: {
      organizationId: ORG,
      journalId: "ot_intro",
      title: "E2E Бумажный вводный инструктаж",
      rows: [["05.09.2026", "Иванов И.И.", "повар", "", "", ""], ["05.09.2026", "Петров П.П.", "повар", "", "", ""]],
      dateFrom: new Date("2026-09-01T00:00:00Z"),
      dateTo: new Date("2026-09-30T00:00:00Z"),
      responsible: "E2E Гайд",
    },
    select: { id: true, journalId: true, status: true, title: true },
  });
  fs.writeFileSync(".agent/tasks/mobile-journals-2026-09/e2e/paper.json", JSON.stringify({ paper: [doc] }, null, 1));
  console.log(JSON.stringify(doc));
  await db.$disconnect();
})();
