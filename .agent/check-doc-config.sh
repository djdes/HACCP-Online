#!/bin/bash
cd /var/www/wesetupru/data/www/wesetup.ru/app
set -a
. ./.env
set +a
cat > scripts/_check-doc.ts <<'TS'
import { db } from "@/lib/db";
async function main() {
  const docs = await db.journalDocument.findMany({
    where: {
      organizationId: "cmoeqzj5e0001ljtso1o1q3fi",
      template: { code: "cold_equipment_control" },
      status: "active",
    },
    select: { id: true, title: true, config: true },
  });
  for (const d of docs) {
    console.log(`\n=== ${d.id} :: ${d.title} ===`);
    console.log(JSON.stringify(d.config, null, 2));
  }
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
TS
npx tsx scripts/_check-doc.ts
rm scripts/_check-doc.ts
