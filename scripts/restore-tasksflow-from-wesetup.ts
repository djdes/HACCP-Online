/**
 * Partial restore TasksFlow БД из WeSetup-side данных.
 *
 * Что делаем:
 *  1) Удаляем 2 свежие тестовые строки в companies/users (id=1,2 от 28.04 16:07).
 *  2) Восстанавливаем companies из tasksflowCompanyId всех TasksFlowIntegration
 *     (имя = Organization.name).
 *  3) Восстанавливаем users из TasksFlowUserLink.tasksflowUserId (phone, name
 *     из WeSetup User по wesetupUserId, is_admin = true если role в management,
 *     company_id из integration).
 *  4) Восстанавливаем workers из TasksFlowUserLink.tasksflowWorkerId.
 *  5) Восстанавливаем api_keys для каждого enabled integration.
 *  6) Re-enable все integration в WeSetup (раньше disabled все 9).
 *
 * Что НЕ восстанавливается:
 *  - tasks (мы не сохраняли titles/descriptions у себя — потеряны)
 *  - invitations (новая фича, у нас нет)
 *  - webhook_deliveries (очередь, не критична)
 *
 * Печатает большой SQL — pipe в mysql CLI вручную:
 *   npx tsx scripts/restore-tasksflow-from-wesetup.ts > /tmp/restore-tf-full.sql
 *   mysql -h 192.168.33.3 -u tasksflow -pTasksFlow2026Prod22 tasksflow < /tmp/restore-tf-full.sql
 */
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";

function s(v: string | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function toBool01(v: boolean): number {
  return v ? 1 : 0;
}

const MGMT_ROLES = new Set([
  "owner",
  "manager",
  "head_chef",
  "technologist",
  "admin",
]);

async function main() {
  // ----- WeSetup data -----
  const integrations = await db.tasksFlowIntegration.findMany({
    where: { tasksflowCompanyId: { not: null } },
    select: {
      id: true,
      organizationId: true,
      apiKeyEncrypted: true,
      tasksflowCompanyId: true,
    },
  });
  console.error(`integrations: ${integrations.length}`);

  const orgIds = integrations.map((i) => i.organizationId);
  const orgs = await db.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

  const userLinks = await db.tasksFlowUserLink.findMany({
    where: { integrationId: { in: integrations.map((i) => i.id) } },
    select: {
      integrationId: true,
      wesetupUserId: true,
      phone: true,
      tasksflowUserId: true,
      tasksflowWorkerId: true,
    },
  });
  console.error(`user-links: ${userLinks.length}`);

  const wesetupUsers = await db.user.findMany({
    where: { id: { in: userLinks.map((l) => l.wesetupUserId) } },
    select: { id: true, name: true, role: true },
  });
  const wesetupUserById = new Map(wesetupUsers.map((u) => [u.id, u]));
  const integrationToCompanyId = new Map(
    integrations.map((i) => [i.id, i.tasksflowCompanyId as number])
  );

  // ----- Build SQL -----
  const lines: string[] = [];
  lines.push(
    "-- TasksFlow partial restore from WeSetup-side data (no tasks/invitations)."
  );
  lines.push("SET autocommit = 0;");
  lines.push("SET FOREIGN_KEY_CHECKS = 0;");
  lines.push("START TRANSACTION;");
  lines.push("");
  lines.push("-- 1. Wipe тестовых строк (созданы 28.04 16:07 после wipe).");
  lines.push("DELETE FROM api_keys;");
  lines.push("DELETE FROM workers;");
  lines.push("DELETE FROM users;");
  lines.push("DELETE FROM companies;");
  lines.push("");

  // ----- companies -----
  lines.push("-- 2. companies (id = tasksflowCompanyId, name = WeSetup Organization.name)");
  const seenCompanies = new Set<number>();
  const now = Math.floor(Date.now() / 1000);
  for (const i of integrations) {
    const cid = i.tasksflowCompanyId as number;
    if (seenCompanies.has(cid)) continue;
    seenCompanies.add(cid);
    const name = orgNameById.get(i.organizationId) ?? `Org #${cid}`;
    lines.push(
      `INSERT IGNORE INTO companies (id, name, email, created_at) VALUES (${cid}, ${s(
        name
      )}, NULL, ${now});`
    );
  }
  lines.push("");

  // ----- users -----
  lines.push("-- 3. users (id = tasksflowUserId, name+is_admin из WeSetup User)");
  const seenUsers = new Set<number>();
  for (const l of userLinks) {
    const tid = l.tasksflowUserId;
    if (!tid || seenUsers.has(tid)) continue;
    seenUsers.add(tid);
    const wu = wesetupUserById.get(l.wesetupUserId);
    const name = wu?.name ?? "(имя утрачено)";
    const isAdmin = wu ? toBool01(MGMT_ROLES.has(wu.role)) : 0;
    const companyId = integrationToCompanyId.get(l.integrationId) ?? null;
    if (!companyId) continue;
    lines.push(
      `INSERT IGNORE INTO users (id, phone, name, is_admin, created_at, bonus_balance, company_id, managed_worker_ids, position) VALUES (${tid}, ${s(
        l.phone
      )}, ${s(name)}, ${isAdmin}, ${now}, 0, ${companyId}, NULL, NULL);`
    );
  }
  lines.push("");

  // ----- workers -----
  lines.push("-- 4. workers (id = tasksflowWorkerId, name из User)");
  const seenWorkers = new Set<number>();
  for (const l of userLinks) {
    const wid = l.tasksflowWorkerId;
    if (!wid || seenWorkers.has(wid)) continue;
    seenWorkers.add(wid);
    const wu = wesetupUserById.get(l.wesetupUserId);
    const name = wu?.name ?? "(имя утрачено)";
    const companyId = integrationToCompanyId.get(l.integrationId) ?? null;
    if (!companyId) continue;
    lines.push(
      `INSERT IGNORE INTO workers (id, name, company_id) VALUES (${wid}, ${s(
        name
      )}, ${companyId});`
    );
  }
  lines.push("");

  // ----- api_keys -----
  lines.push("-- 5. api_keys из encrypted plaintexts (created_by = первый user той company)");
  for (const i of integrations) {
    try {
      const plaintext = decryptSecret(i.apiKeyEncrypted);
      const keyHash = crypto
        .createHash("sha256")
        .update(plaintext)
        .digest("hex");
      const keyPrefix = plaintext.slice(0, 12);
      const companyId = i.tasksflowCompanyId as number;
      const orgName = orgNameById.get(i.organizationId) ?? `Org #${companyId}`;
      // created_by_user_id — берём первого user той company через subselect.
      lines.push(
        `INSERT IGNORE INTO api_keys (name, key_hash, key_prefix, company_id, created_by_user_id, created_at) ` +
          `SELECT ${s(`Восстановлен (${orgName})`)}, ${s(keyHash)}, ${s(
            keyPrefix
          )}, ${companyId}, u.id, ${now} ` +
          `FROM users u WHERE u.company_id = ${companyId} ` +
          `ORDER BY (u.is_admin = 1) DESC, u.id ASC LIMIT 1;`
      );
    } catch (err) {
      lines.push(
        `-- skipped api_key for ${i.organizationId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
  lines.push("");

  lines.push("COMMIT;");
  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("");
  lines.push("-- Final counts:");
  lines.push(
    "SELECT (SELECT COUNT(*) FROM companies) AS companies, (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM workers) AS workers, (SELECT COUNT(*) FROM api_keys) AS api_keys;"
  );

  console.log(lines.join("\n"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
