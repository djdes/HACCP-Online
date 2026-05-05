/**
 * One-off backfill: для конкретной орги пройти каскадом по всем активным
 * документам каждого журнала, чтобы verifierUserId заполнился из
 * сохранённых slot-юзеров. Используется когда документы создавали через
 * `recreate-documents` до фикса (verifier silently dropped) — теперь они
 * висят со status=active, responsibleUserId=ok, но verifierUserId=null.
 *
 * Usage: tsx scripts/backfill-verifiers.ts <orgId-or-email>
 */
import { db } from "../src/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "../src/lib/journal-catalog";
import { cascadeResponsibleToActiveDocuments } from "../src/lib/journal-responsibles-cascade";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/backfill-verifiers.ts <orgId-or-email>");
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

  const [templates, accessRows, org] = await Promise.all([
    db.journalTemplate.findMany({
      where: { code: { in: ACTIVE_JOURNAL_CATALOG.map((j) => j.code) } },
      select: { id: true, code: true },
    }),
    db.jobPositionJournalAccess.findMany({
      where: { organizationId },
      select: { templateId: true, jobPositionId: true },
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, journalResponsibleUsersJson: true },
    }),
  ]);

  if (!org) {
    console.error("org not found");
    process.exit(3);
  }

  console.log(`Org: ${org.name}\n`);

  const positionsByTemplate = new Map<string, string[]>();
  for (const r of accessRows) {
    const list = positionsByTemplate.get(r.templateId) ?? [];
    list.push(r.jobPositionId);
    positionsByTemplate.set(r.templateId, list);
  }

  const orgSlots = (org.journalResponsibleUsersJson ?? {}) as Record<
    string,
    Record<string, string | null>
  >;

  let total = 0;
  for (const tpl of templates) {
    const slots = orgSlots[tpl.code];
    if (!slots) {
      console.log(`  - ${tpl.code}: no slots → skip`);
      continue;
    }
    const cascade = await cascadeResponsibleToActiveDocuments({
      organizationId,
      templateId: tpl.id,
      journalCode: tpl.code,
      positionIds: positionsByTemplate.get(tpl.id) ?? [],
      slotUsers: slots,
      scope: "active-any",
    });
    total += cascade.documentsUpdated;
    console.log(
      `  - ${tpl.code}: updated ${cascade.documentsUpdated} doc(s), primary=${cascade.pickedPrimaryUserId ?? "—"}`
    );
  }

  console.log(`\nTotal docs updated: ${total}`);

  // Verify: count docs without verifier
  const noVerifier = await db.journalDocument.count({
    where: { organizationId, status: "active", verifierUserId: null },
  });
  const total2 = await db.journalDocument.count({
    where: { organizationId, status: "active" },
  });
  console.log(`After: ${total2 - noVerifier}/${total2} docs have verifierUserId`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(99);
  });
