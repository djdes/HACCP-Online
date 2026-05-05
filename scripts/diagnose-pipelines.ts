/**
 * Per-journal pipeline status: для каждого активного журнала смотрим
 * есть ли JournalPipelineTemplate, сколько узлов в нём, видно ли
 * pinned/custom-узлы, и считаем pipeline-coverage по орге.
 */
import { db } from "../src/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "../src/lib/journal-catalog";
import { PIPELINE_EXEMPT_JOURNALS } from "../src/lib/journal-default-pipelines";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/diagnose-pipelines.ts <orgId-or-email>");
    process.exit(1);
  }
  let organizationId = arg;
  if (arg.includes("@")) {
    const u = await db.user.findFirst({
      where: { email: arg },
      select: { organizationId: true },
    });
    if (!u) {
      console.error("user not found");
      process.exit(2);
    }
    organizationId = u.organizationId;
  }

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (!org) {
    console.error("org not found");
    process.exit(3);
  }
  console.log(`Org: ${org.name}\n`);

  const templates = await db.journalTemplate.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  let totalCovered = 0;
  let totalExempt = 0;
  let totalMissing = 0;

  for (const tpl of templates) {
    const exempt = PIPELINE_EXEMPT_JOURNALS.has(tpl.code);
    const ptpl = await db.journalPipelineTemplate.findFirst({
      where: { organizationId, templateCode: tpl.code },
      select: { id: true },
    });
    let pinned = 0;
    let custom = 0;
    if (ptpl) {
      const counts = await db.journalPipelineNode.groupBy({
        by: ["kind"],
        where: { templateId: ptpl.id },
        _count: { kind: true },
      });
      for (const c of counts) {
        if (c.kind === "pinned") pinned = c._count.kind;
        else if (c.kind === "custom") custom = c._count.kind;
      }
    }
    const status = exempt
      ? "EXEMPT (own adapter)"
      : pinned + custom > 0
        ? `OK (pinned=${pinned}, custom=${custom})`
        : "MISSING";
    if (exempt) totalExempt++;
    else if (pinned + custom > 0) totalCovered++;
    else totalMissing++;
    console.log(`  ${tpl.code.padEnd(36)} → ${status}`);
  }

  console.log(
    `\nSummary: covered=${totalCovered}, exempt=${totalExempt}, missing=${totalMissing} of ${templates.length}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(99);
  });
