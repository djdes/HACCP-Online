/**
 * QA-скрипт: для одной организации
 *   1. Удаляет все TaskLinks (опционально — и сами TF-задачи).
 *   2. Печатает текущую compliance.
 *
 * Безопасен для использования: трогает только указанную orgId.
 *
 * Usage on prod:
 *   ORG_ID=<org-id> npx tsx scripts/_qa-clear-and-resend.ts
 */
import { db } from "@/lib/db";
import { tasksflowClientFor } from "@/lib/tasksflow-client";

async function main() {
  const orgId = process.env.ORG_ID;
  if (!orgId) {
    console.error("Set ORG_ID env var");
    process.exit(1);
  }

  const integration = await db.tasksFlowIntegration.findFirst({
    where: { organizationId: orgId },
    select: {
      id: true,
      organizationId: true,
      baseUrl: true,
      apiKeyEncrypted: true,
      enabled: true,
      tasksflowCompanyId: true,
      label: true,
    },
  });

  console.log(
    "Integration:",
    integration ? `id=${integration.id} enabled=${integration.enabled}` : "none"
  );

  const links = await db.tasksFlowTaskLink.findMany({
    where: { integration: { organizationId: orgId } },
    select: { id: true, tasksflowTaskId: true, remoteStatus: true },
  });
  console.log(`TaskLinks: total=${links.length}`);

  if (integration && integration.enabled && links.length > 0) {
    const client = tasksflowClientFor(integration);
    let deletedTf = 0;
    let tfErr = 0;
    for (const link of links) {
      try {
        await client.deleteTask(link.tasksflowTaskId);
        deletedTf += 1;
      } catch (err) {
        tfErr += 1;
        console.warn(`  delete TF #${link.tasksflowTaskId}:`, (err as Error).message);
      }
    }
    console.log(`Deleted on TF side: ${deletedTf}, errors: ${tfErr}`);
  }

  const r = await db.tasksFlowTaskLink.deleteMany({
    where: { integration: { organizationId: orgId } },
  });
  console.log(`Deleted local TaskLinks: ${r.count}`);

  const remain = await db.tasksFlowTaskLink.count({
    where: { integration: { organizationId: orgId } },
  });
  console.log(`Remaining: ${remain}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
