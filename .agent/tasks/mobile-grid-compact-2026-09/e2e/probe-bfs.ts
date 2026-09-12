import { db } from "../../partner-autonomy-2026-09/e2e/db";

async function main() {
  const orgs = await db.organization.findMany({
    where: { name: { contains: "БФС", mode: "insensitive" } },
    select: { id: true, name: true, perLocationJournals: true },
  });
  console.log("орг:", JSON.stringify(orgs));

  for (const org of orgs) {
    const docs = await db.journalDocument.findMany({
      where: { organizationId: org.id, template: { code: "cold_equipment_control" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, dateFrom: true, dateTo: true, status: true, config: true, _count: { select: { entries: true } } },
    });
    for (const doc of docs) {
      const config = (doc.config ?? {}) as { equipment?: Array<{ name?: string }> };
      console.log(
        org.name,
        doc.id,
        doc.dateFrom.toISOString().slice(0, 10),
        "→",
        doc.dateTo.toISOString().slice(0, 10),
        `дней=${Math.round((+doc.dateTo - +doc.dateFrom) / 86400000) + 1}`,
        `оборудование=${config.equipment?.length ?? 0}`,
        `записей=${doc._count.entries}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
