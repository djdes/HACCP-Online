/* eslint-disable no-console */
import { db } from "../../../../src/lib/db";
const ORG = "cmoe6rpt4000097ts71yb922y";
(async () => {
  const org = await db.organization.findUnique({ where: { id: ORG }, select: { perLocationJournals: true } });
  const paper = await db.paperJournalDocument.findMany({ where: { organizationId: ORG }, select: { id: true, journalId: true, status: true, title: true }, orderBy: { createdAt: "desc" } });
  console.log(JSON.stringify({ org, paper }, null, 1));
  await db.$disconnect();
})();
