#!/bin/bash
cd /var/www/wesetupru/data/www/wesetup.ru/app
set -a
. ./.env
set +a
cat > scripts/_find-missing.ts <<'TS'
import { db } from "@/lib/db";
import { getTemplatesFilledToday } from "@/lib/today-compliance";

async function main() {
  const orgId = "cmoeqzj5e0001ljtso1o1q3fi";
  const templates = await db.journalTemplate.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const filled = await getTemplatesFilledToday(orgId, new Date(), templates, new Set(), { treatAperiodicAsFilled: false });
  const missing = templates.filter(t => !filled.has(t.id));
  console.log(`Missing ${missing.length}:`);
  for (const m of missing) console.log(`  ${m.code} :: ${m.name}`);
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
TS
npx tsx scripts/_find-missing.ts
rm scripts/_find-missing.ts
