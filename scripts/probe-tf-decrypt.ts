/**
 * One-shot probe: пытаемся расшифровать apiKey каждой
 * TasksFlowIntegration текущим INTEGRATION_KEY_SECRET / NEXTAUTH_SECRET.
 * Печатает список с org-id, длиной blob'а и результатом (ok|fail+reason).
 *
 * Используется когда юзер видит «Не удалось получить превью» — это
 * почти всегда decrypt failure после ротации секрета. Этот скрипт
 * показывает у кого именно сломано.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { decryptSecret } from "../src/lib/integration-crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const rows = await prisma.tasksFlowIntegration.findMany({
    select: {
      id: true,
      organizationId: true,
      enabled: true,
      apiKeyEncrypted: true,
      organization: { select: { name: true } },
    },
  });

  let okCount = 0;
  let failCount = 0;
  for (const r of rows) {
    const blob = r.apiKeyEncrypted;
    const len = blob?.length ?? 0;
    let status = "ok";
    let detail = "";
    try {
      const dec = decryptSecret(blob);
      detail = `(plaintext ${dec.length} chars, prefix ${dec.slice(0, 6)}…)`;
      okCount += 1;
    } catch (err: any) {
      status = "FAIL";
      detail = err?.message ?? String(err);
      failCount += 1;
    }
    const enabledMark = r.enabled ? "ON " : "off";
    const orgName = (r.organization?.name ?? "").slice(0, 30).padEnd(30);
    console.log(
      `${enabledMark} | len=${len} | org=${orgName} | ${status} | ${detail}`,
    );
  }
  console.log(`\nTotal: ${rows.length}, ok=${okCount}, fail=${failCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
