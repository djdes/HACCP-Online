/* eslint-disable no-console */
import { db } from "../../../../src/lib/db";

const ORG = "cmoe6rpt4000097ts71yb922y";
(async () => {
  const docs = await db.journalDocument.findMany({
    where: { organizationId: ORG },
    select: { id: true, status: true, createdAt: true, template: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const byCode = new Map<string, { id: string; status: string; name: string }>();
  for (const d of docs) {
    const code = d.template.code;
    const cur = byCode.get(code);
    if (!cur || (cur.status !== "active" && d.status === "active")) byCode.set(code, { id: d.id, status: d.status, name: d.template.name });
  }
  const templates = await db.journalTemplate.findMany({ select: { code: true, name: true, isActive: true } });
  const out = { docs: Object.fromEntries(byCode), templateCodes: templates.map((t) => t.code) };
  console.log(JSON.stringify(out, null, 1));
  await db.$disconnect();
})();
