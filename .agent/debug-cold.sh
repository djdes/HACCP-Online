#!/bin/bash
cd /var/www/wesetupru/data/www/wesetup.ru/app
set -a
. ./.env
set +a
cat > scripts/_debug-cold.ts <<'TS'
import { db } from "@/lib/db";
import { mintTaskFillToken } from "@/lib/task-fill-token";

async function main() {
  const link = await db.tasksFlowTaskLink.findFirst({
    where: {
      integration: { organizationId: "cmoeqzj5e0001ljtso1o1q3fi" },
      journalCode: "cold_equipment_control",
      remoteStatus: "active",
    },
    include: { integration: true },
  });
  if (!link) {
    console.log("no link");
    return;
  }
  const token = mintTaskFillToken(link.tasksflowTaskId, link.integration.webhookSecret);

  const doc = await db.journalDocument.findUnique({
    where: { id: link.journalDocumentId },
    select: { config: true },
  });
  const cfg = doc?.config as { equipment?: Array<{ id: string; name: string; min?: number; max?: number }> };
  console.log(`Document equipment count: ${cfg?.equipment?.length ?? 0}`);
  for (const e of (cfg?.equipment ?? [])) {
    console.log(`  ${e.id} -> ${e.name} (${e.min}..${e.max})`);
  }

  // Build values for ALL equipment in config + 1 extra to test passthrough
  const values: Record<string, number> = {};
  for (const e of (cfg?.equipment ?? [])) {
    const lo = typeof e.min === "number" ? e.min : 0;
    const hi = typeof e.max === "number" ? e.max : 6;
    values[`t_${e.id}`] = Math.round((lo + hi) / 2 * 10) / 10;
  }
  console.log(`Values to send: ${Object.keys(values).length} keys`);
  console.log(JSON.stringify(values, null, 2));

  const url = `https://wesetup.ru/api/task-fill/${link.tasksflowTaskId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, values }),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}: ${text.slice(0, 600)}`);

  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
TS
npx tsx scripts/_debug-cold.ts
rm scripts/_debug-cold.ts
