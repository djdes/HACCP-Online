#!/bin/bash
cd /var/www/wesetupru/data/www/wesetup.ru/app
set -a
. ./.env
set +a
cat > scripts/_qa-complete-all.ts <<'TS'
/**
 * Завершить все active TaskLinks в org через `/api/task-fill/[id]` —
 * имитирует worker-flow без отдельного логина (HMAC-token из integration
 * webhook secret).
 *
 * Default values per field type:
 *   boolean  → true
 *   number   → midpoint of (min..max) или 0 / тип-зависимое
 *   text     → "QA-тест"
 *   select   → первый option
 *   date/time → текущие
 */
import { db } from "@/lib/db";
import { mintTaskFillToken } from "@/lib/task-fill-token";
import { getAdapter } from "@/lib/tasksflow-adapters";

const ORG_ID = process.env.ORG_ID!;
if (!ORG_ID) {
  console.error("Set ORG_ID");
  process.exit(1);
}

type FieldDef = {
  key: string;
  type: string;
  required?: boolean;
  options?: Array<{ value: string }>;
  min?: number;
  max?: number;
  maxLength?: number;
  label?: string;
};

function buildValuesFromSchema(fields: FieldDef[]): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  const HHMM = new Date().toISOString().slice(11, 16); // "13:42"
  for (const f of fields) {
    // Эвристика для time-полей объявленных как text с maxLength=5
    // или с label содержащим "ЧЧ:ММ".
    const looksLikeTime =
      f.type === "text" &&
      ((f.maxLength === 5) || (f.label ?? "").includes("ЧЧ:ММ"));

    if (looksLikeTime) {
      v[f.key] = HHMM;
      continue;
    }
    switch (f.type) {
      case "boolean":
        v[f.key] = true;
        break;
      case "number": {
        const lo = typeof f.min === "number" ? f.min : 0;
        const hi = typeof f.max === "number" ? f.max : lo + 10;
        // Среднее, но в безопасной зоне (если min < 0 — берём 0)
        const mid = (lo + hi) / 2;
        const safe = lo < 0 && hi > 0 ? Math.max(0, Math.min(hi - 1, 4)) : mid;
        v[f.key] = Math.round(safe * 10) / 10;
        break;
      }
      case "select":
        if (Array.isArray(f.options) && f.options.length > 0) {
          v[f.key] = f.options[0].value;
        }
        break;
      case "text":
      case "textarea": {
        const max = typeof f.maxLength === "number" ? f.maxLength : 100;
        const sample = "QA-тест";
        v[f.key] = sample.length <= max ? sample : sample.slice(0, max);
        break;
      }
      case "date":
        v[f.key] = new Date().toISOString().slice(0, 10);
        break;
      case "time":
        v[f.key] = HHMM;
        break;
      default:
        v[f.key] = "ok";
    }
  }
  return v;
}

async function main() {
  const links = await db.tasksFlowTaskLink.findMany({
    where: {
      integration: { organizationId: ORG_ID },
      remoteStatus: "active",
    },
    include: { integration: true },
  });
  console.log(`Active TaskLinks: ${links.length}`);

  const baseUrl =
    (process.env.NEXTAUTH_URL ?? "https://wesetup.ru").replace(/\/+$/, "");

  const counts = {
    ok: 0,
    fail: 0,
    skipUnsupported: 0,
    failByCode: {} as Record<string, number>,
  };
  const failures: Array<{ taskId: number; code: string; error: string }> = [];

  for (const link of links) {
    const adapter = getAdapter(link.journalCode);
    if (!adapter) {
      counts.skipUnsupported += 1;
      continue;
    }

    let values: Record<string, unknown> = {};
    if (adapter.getTaskForm) {
      try {
        const schema = await adapter.getTaskForm({
          documentId: link.journalDocumentId,
          rowKey: link.rowKey,
        });
        if (schema?.fields) {
          values = buildValuesFromSchema(schema.fields as FieldDef[]);
        }
      } catch (err) {
        console.warn(
          `getTaskForm failed for ${link.journalCode}#${link.tasksflowTaskId}:`,
          (err as Error).message
        );
      }
    }

    const token = mintTaskFillToken(
      link.tasksflowTaskId,
      link.integration.webhookSecret
    );
    const url = `${baseUrl}/api/task-fill/${link.tasksflowTaskId}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, values }),
      });
    } catch (err) {
      counts.fail += 1;
      failures.push({
        taskId: link.tasksflowTaskId,
        code: link.journalCode,
        error: `network: ${(err as Error).message}`,
      });
      continue;
    }
    if (res.ok) {
      counts.ok += 1;
    } else {
      counts.fail += 1;
      counts.failByCode[link.journalCode] =
        (counts.failByCode[link.journalCode] ?? 0) + 1;
      const text = await res.text().catch(() => "");
      failures.push({
        taskId: link.tasksflowTaskId,
        code: link.journalCode,
        error: `${res.status}: ${text.slice(0, 200)}`,
      });
    }
  }

  console.log(JSON.stringify(counts, null, 2));
  if (failures.length > 0) {
    console.log("\nFAILURES (first 10):");
    for (const f of failures.slice(0, 10)) {
      console.log(`  task=${f.taskId} code=${f.code}: ${f.error}`);
    }
  }

  // Debug первого упавшего: распечатать схему и values
  if (failures.length > 0 && process.env.DEBUG_FAIL === "1") {
    const failTask = links.find(
      (l) => l.tasksflowTaskId === failures[0].taskId
    );
    if (failTask) {
      const adapter = getAdapter(failTask.journalCode);
      if (adapter?.getTaskForm) {
        const schema = await adapter.getTaskForm({
          documentId: failTask.journalDocumentId,
          rowKey: failTask.rowKey,
        });
        const values = buildValuesFromSchema(
          (schema?.fields ?? []) as FieldDef[]
        );
        console.log("\nDEBUG schema:", JSON.stringify(schema, null, 2));
        console.log("DEBUG values:", JSON.stringify(values, null, 2));
      }
    }
  }
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
TS
ORG_ID="$1" npx tsx scripts/_qa-complete-all.ts
rm scripts/_qa-complete-all.ts
