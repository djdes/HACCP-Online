import { db } from "../../partner-autonomy-2026-09/e2e/db";

async function main() {
  const docs = await db.journalDocument.findMany({
    where: { template: { code: process.argv[2] ?? "cold_equipment_control" } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      dateFrom: true,
      dateTo: true,
      status: true,
      organizationId: true,
      organization: { select: { name: true } },
      _count: { select: { entries: true } },
    },
  });
  console.log(JSON.stringify(docs, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
