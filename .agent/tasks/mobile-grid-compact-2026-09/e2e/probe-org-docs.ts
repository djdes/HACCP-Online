import { db } from "../../partner-autonomy-2026-09/e2e/db";

async function main() {
  const orgId = process.argv[2] ?? "cmtbo1xnc00848ctszzywbwwq";
  const docs = await db.journalDocument.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      dateFrom: true,
      dateTo: true,
      status: true,
      template: { select: { code: true } },
    },
  });
  const byCode = new Map<string, string>();
  for (const doc of docs) {
    if (!byCode.has(doc.template.code)) {
      byCode.set(
        doc.template.code,
        `${doc.id}  ${doc.dateFrom.toISOString().slice(0, 10)}→${doc.dateTo.toISOString().slice(0, 10)}  ${doc.status}`,
      );
    }
  }
  for (const [code, info] of byCode) console.log(code.padEnd(28), info);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
