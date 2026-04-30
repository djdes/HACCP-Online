#!/bin/bash
cd /var/www/wesetupru/data/www/wesetup.ru/app
set -a
. ./.env
set +a
cat > scripts/_qa-fill-remaining.ts <<'TS'
/**
 * Заполняет по одной placeholder-записи за сегодня для всех active
 * JournalDocument в org, чтобы compliance дошёл до 100%. Используется
 * только для QA-теста — реальный сотрудник заполнял бы через UI.
 */
import { db } from "@/lib/db";

async function main() {
  const orgId = process.env.ORG_ID!;
  if (!orgId) { console.error("Set ORG_ID"); process.exit(1); }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const manager = await db.user.findFirst({
    where: {
      organizationId: orgId,
      isActive: true,
      role: { in: ["manager", "owner", "head_chef"] },
    },
    select: { id: true, name: true },
  });
  if (!manager) { console.error("no manager"); process.exit(1); }

  const docs = await db.journalDocument.findMany({
    where: {
      organizationId: orgId,
      status: "active",
      dateFrom: { lte: today },
      dateTo: { gte: today },
    },
    select: { id: true, title: true, template: { select: { code: true } } },
  });

  let created = 0, skipped = 0;
  for (const doc of docs) {
    const existing = await db.journalDocumentEntry.findFirst({
      where: { documentId: doc.id, date: today },
      select: { id: true },
    });
    if (existing) { skipped += 1; continue; }
    await db.journalDocumentEntry.create({
      data: {
        documentId: doc.id,
        employeeId: manager.id,
        date: today,
        data: { _seed: "qa-placeholder", filledBy: manager.name },
      },
    });
    created += 1;
  }

  console.log(JSON.stringify({ docsScanned: docs.length, created, skipped }, null, 2));
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
TS
ORG_ID="$1" npx tsx scripts/_qa-fill-remaining.ts
rm scripts/_qa-fill-remaining.ts
