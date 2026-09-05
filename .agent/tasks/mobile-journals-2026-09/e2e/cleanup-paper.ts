import { db } from "../../../../src/lib/db";
(async () => {
  const r = await db.paperJournalDocument.deleteMany({ where: { organizationId: "cmoe6rpt4000097ts71yb922y", title: { startsWith: "E2E " } } });
  console.log("deleted paper docs:", r.count);
  await db.$disconnect();
})();
