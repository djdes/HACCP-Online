/**
 * Диагностика конкретной организации — что настроено, чего не хватает,
 * какие документы есть, какие пустые, и что reasonable нашему «Quick-start»
 * чек-листу.
 *
 * Запускается напрямую на проде:
 *   npx tsx scripts/diagnose-org.ts <email-or-orgId>
 */
import { db } from "../src/lib/db";
import { getDefaultConfigForJournal } from "../src/lib/journal-default-configs";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/diagnose-org.ts <email-or-orgId>");
    process.exit(1);
  }

  // Find org by user email or by direct id.
  let orgId: string | null = null;
  let foundUser: { id: string; name: string; email: string; role: string } | null = null;
  if (arg.includes("@")) {
    const u = await db.user.findFirst({
      where: { email: arg },
      select: { id: true, name: true, email: true, role: true, organizationId: true },
    });
    if (!u) {
      console.error(`No user with email ${arg}`);
      process.exit(2);
    }
    foundUser = { id: u.id, name: u.name, email: u.email, role: u.role };
    orgId = u.organizationId;
  } else {
    orgId = arg;
  }

  const org = await db.organization.findUnique({
    where: { id: orgId! },
    select: {
      id: true,
      name: true,
      type: true,
      inn: true,
      address: true,
      taskFlowMode: true,
      journalPipelinesJson: true,
      journalResponsibleUsersJson: true,
      disabledJournalCodes: true,
      autoJournalCodes: true,
    },
  });
  if (!org) {
    console.error(`No org with id ${orgId}`);
    process.exit(3);
  }

  console.log("═".repeat(70));
  console.log(`ORG: ${org.name} (${org.id})`);
  console.log(`Type: ${org.type}, INN: ${org.inn ?? "—"}, Addr: ${org.address ?? "—"}`);
  if (foundUser) {
    console.log(`Caller: ${foundUser.name} (${foundUser.email}, ${foundUser.role})`);
  }
  console.log("═".repeat(70));

  // === USERS ===
  const users = await db.user.findMany({
    where: { organizationId: org.id, isActive: true, archivedAt: null },
    select: {
      id: true,
      name: true,
      role: true,
      telegramChatId: true,
      jobPosition: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  const usersWithTg = users.filter((u) => u.telegramChatId).length;
  console.log(`\n• USERS: ${users.length} active (${usersWithTg} with TG)`);
  for (const u of users) {
    console.log(
      `  - ${u.name} [${u.role}${u.jobPosition?.name ? ` · ${u.jobPosition.name}` : ""}]${u.telegramChatId ? " 📱" : ""}`
    );
  }

  // === STRUCTURE ===
  const positions = await db.jobPosition.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  const buildings = await db.building.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  const rooms = await db.room.findMany({
    where: { building: { organizationId: org.id } },
    select: { id: true, name: true, buildingId: true },
  });
  const areas = await db.area.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  const equipment = await db.equipment.findMany({
    where: { area: { organizationId: org.id } },
    select: { id: true, name: true, type: true, tempMin: true, tempMax: true },
  });
  const products = await db.product.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });

  console.log(`\n• POSITIONS: ${positions.length}`);
  positions.forEach((p) => console.log(`  - ${p.name}`));
  console.log(`\n• BUILDINGS/ROOMS: ${buildings.length} buildings, ${rooms.length} rooms`);
  buildings.forEach((b) => console.log(`  - ${b.name}`));
  rooms.forEach((r) => console.log(`    · room: ${r.name}`));
  console.log(`\n• AREAS (цеха): ${areas.length}`);
  areas.forEach((a) => console.log(`  - ${a.name}`));
  console.log(`\n• EQUIPMENT: ${equipment.length}`);
  equipment
    .slice(0, 20)
    .forEach((e) =>
      console.log(
        `  - ${e.name} [${e.type ?? "—"}]${e.tempMin != null || e.tempMax != null ? ` ${e.tempMin ?? "?"}…${e.tempMax ?? "?"}°C` : ""}`
      )
    );
  if (equipment.length > 20) console.log(`  ... +${equipment.length - 20} more`);
  console.log(`\n• PRODUCTS: ${products.length}`);

  // === JOURNALS ===
  const allTemplates = await db.journalTemplate.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const disabled = (org.disabledJournalCodes as string[] | null) ?? [];
  const enabled = allTemplates.filter((t) => !disabled.includes(t.code));
  console.log(`\n• ACTIVE TEMPLATES: ${allTemplates.length}, disabled: ${disabled.length}, enabled: ${enabled.length}`);

  // === RESPONSIBLES ===
  const respJson = (org.journalResponsibleUsersJson as Record<
    string,
    Record<string, string | null>
  > | null) ?? {};
  let withResp = 0;
  let respMissing: string[] = [];
  for (const t of enabled) {
    const slots = respJson[t.code];
    if (slots && Object.values(slots).some((v) => v)) withResp++;
    else respMissing.push(`${t.code} (${t.name})`);
  }
  console.log(`\n• RESPONSIBLES: ${withResp}/${enabled.length} journals have at least one slot filled`);
  if (respMissing.length > 0) {
    console.log(`  Missing responsibles for ${respMissing.length} enabled journals:`);
    respMissing.slice(0, 10).forEach((r) => console.log(`    ⚠ ${r}`));
    if (respMissing.length > 10) console.log(`    ... +${respMissing.length - 10} more`);
  }

  // === DOCUMENTS ===
  const docs = await db.journalDocument.findMany({
    where: { organizationId: org.id, status: "active" },
    select: {
      id: true,
      title: true,
      template: { select: { code: true, name: true } },
      config: true,
      responsibleUserId: true,
      verifierUserId: true,
      dateFrom: true,
      dateTo: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\n• ACTIVE DOCUMENTS: ${docs.length}`);

  // Документы с пустым config — точка боли.
  const emptyDocs: typeof docs = [];
  const docsNoResponsible: typeof docs = [];
  const docsNoVerifier: typeof docs = [];
  for (const d of docs) {
    const cfg = d.config as Record<string, unknown> | null;
    if (!cfg || Object.keys(cfg).length === 0) emptyDocs.push(d);
    if (!d.responsibleUserId) docsNoResponsible.push(d);
    if (!d.verifierUserId) docsNoVerifier.push(d);
  }
  if (emptyDocs.length > 0) {
    console.log(`\n  ⚠ ${emptyDocs.length} docs with EMPTY config:`);
    emptyDocs.slice(0, 15).forEach((d) =>
      console.log(`    - ${d.template.code} (${d.title})`)
    );
  }
  if (docsNoResponsible.length > 0) {
    console.log(`\n  ⚠ ${docsNoResponsible.length} docs without responsibleUserId:`);
    docsNoResponsible.slice(0, 15).forEach((d) =>
      console.log(`    - ${d.template.code} (${d.title})`)
    );
  }
  if (docsNoVerifier.length > 0) {
    console.log(`\n  ⚠ ${docsNoVerifier.length} docs without verifierUserId:`);
    docsNoVerifier.slice(0, 10).forEach((d) =>
      console.log(`    - ${d.template.code} (${d.title})`)
    );
  }

  // Per-document detail: rows count by code
  console.log(`\n• PER-DOC ROW STATS:`);
  for (const d of docs) {
    const cfg = d.config as Record<string, unknown> | null;
    let rowsLabel = "?";
    if (!cfg) {
      rowsLabel = "null config";
    } else {
      const obj = cfg as Record<string, unknown>;
      const rowsKey = ["rows", "equipment", "rooms", "subdivisions", "items", "responsibles"].find(
        (k) => Array.isArray(obj[k])
      );
      if (rowsKey) rowsLabel = `${(obj[rowsKey] as unknown[]).length} ${rowsKey}`;
      else rowsLabel = `keys: ${Object.keys(obj).slice(0, 4).join(",")}`;
    }
    console.log(
      `  - ${d.template.code.padEnd(36)} → ${rowsLabel}  (resp: ${d.responsibleUserId ? "✓" : "✗"}, verifier: ${d.verifierUserId ? "✓" : "✗"})`
    );
  }

  // === ENTRIES ===
  const totalEntries = await db.journalDocumentEntry.count({
    where: { document: { organizationId: org.id } },
  });
  console.log(`\n• ENTRIES (всего во всех doc'ах): ${totalEntries}`);

  // === TASKSFLOW ===
  const tf = await db.tasksFlowIntegration.findFirst({
    where: { organizationId: org.id, enabled: true },
    select: { id: true, label: true },
  });
  console.log(`\n• TASKSFLOW: ${tf ? `connected (${tf.label})` : "NOT connected"}`);
  if (tf) {
    const tfLinks = await db.tasksFlowUserLink.count({
      where: { integrationId: tf.id },
    });
    const tfTaskLinks = await db.tasksFlowTaskLink.count({
      where: { integrationId: tf.id },
    });
    console.log(`  • TF user-links: ${tfLinks}/${users.length}`);
    console.log(`  • TF task-links: ${tfTaskLinks}`);
  }

  // === PIPELINE ===
  const pipelinesJson = (org.journalPipelinesJson as Record<string, unknown> | null) ?? {};
  console.log(
    `\n• PIPELINES: ${Object.keys(pipelinesJson).length} configured`
  );

  // === DIAGNOSIS / PROBLEMS ===
  console.log("\n" + "═".repeat(70));
  console.log("DIAGNOSIS:");
  console.log("═".repeat(70));
  const issues: string[] = [];
  if (!org.inn) issues.push("⚠ ИНН не указан");
  if (!org.address) issues.push("⚠ Адрес не указан");
  if (positions.length === 0) issues.push("⚠ 0 должностей");
  if (users.length < 2) issues.push("⚠ < 2 сотрудников");
  if (buildings.length === 0) issues.push("⚠ 0 зданий");
  if (rooms.length === 0) issues.push("⚠ 0 помещений");
  if (areas.length === 0) issues.push("⚠ 0 цехов (Area)");
  if (equipment.length === 0) issues.push("⚠ 0 оборудования");
  if (enabled.length === 0) issues.push("⚠ 0 включённых журналов");
  if (respMissing.length > 0)
    issues.push(`⚠ ${respMissing.length} журналов без ответственных`);
  if (emptyDocs.length > 0)
    issues.push(`⚠ ${emptyDocs.length} документов с пустым config`);
  if (docsNoResponsible.length > 0)
    issues.push(`⚠ ${docsNoResponsible.length} документов без responsibleUserId`);
  if (docsNoVerifier.length > 0)
    issues.push(`⚠ ${docsNoVerifier.length} документов без verifierUserId`);
  if (!tf) issues.push("⚠ TasksFlow не подключён");
  if (Object.keys(pipelinesJson).length < 3) issues.push("⚠ < 3 pipeline'ов настроено");

  if (issues.length === 0) console.log("✓ All checks pass");
  else issues.forEach((i) => console.log("  " + i));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(99);
  });
