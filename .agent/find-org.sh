#!/bin/bash
cd /var/www/wesetupru/data/www/wesetup.ru/app
set -a
. ./.env
set +a
cat > /tmp/_find-org.ts <<'TS'
import { db } from "@/lib/db";
async function main() {
  const orgs = await db.organization.findMany({
    where: { name: { contains: "QA-Тест" } },
    select: { id: true, name: true, type: true },
  });
  console.log(JSON.stringify(orgs, null, 2));
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
TS
cp /tmp/_find-org.ts scripts/_find-org.ts
npx tsx scripts/_find-org.ts
rm scripts/_find-org.ts
