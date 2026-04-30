/**
 * One-shot recovery: TasksFlow api_keys таблица стала пустой.
 * Восстанавливаем строки из наших encrypted plaintexts.
 *
 * Скрипт ВЫВОДИТ SQL — затем нужно вручную пропустить через mysql CLI:
 *   npx tsx scripts/restore-tf-api-keys.ts > /tmp/restore.sql
 *   mysql -h 192.168.33.3 -u tasksflow -pTasksFlow2026Prod22 tasksflow < /tmp/restore.sql
 *
 * Идемпотентно: используем INSERT ... ON DUPLICATE KEY UPDATE чтобы
 * повторный запуск не падал на UNIQUE(key_hash).
 */
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/integration-crypto";

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
}

async function main() {
  const integrationsRaw = await db.tasksFlowIntegration.findMany({
    where: { enabled: true, tasksflowCompanyId: { not: null } },
    select: {
      organizationId: true,
      apiKeyEncrypted: true,
      tasksflowCompanyId: true,
    },
  });
  const orgs = await db.organization.findMany({
    where: { id: { in: integrationsRaw.map((i) => i.organizationId) } },
    select: { id: true, name: true },
  });
  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
  const integrations = integrationsRaw.map((i) => ({
    ...i,
    organization: { name: orgNameById.get(i.organizationId) ?? i.organizationId },
  }));
  console.error(`Found ${integrations.length} integrations.`);

  const now = Math.floor(Date.now() / 1000);
  const lines: string[] = [];
  lines.push(
    "-- Auto-generated restore for TasksFlow api_keys from WeSetup encrypted plaintexts."
  );
  lines.push("SET autocommit = 0;");
  lines.push("START TRANSACTION;");

  for (const i of integrations) {
    try {
      const plaintext = decryptSecret(i.apiKeyEncrypted);
      const keyHash = crypto
        .createHash("sha256")
        .update(plaintext)
        .digest("hex");
      const keyPrefix = plaintext.slice(0, 12);
      const companyId = i.tasksflowCompanyId;
      const name = `Восстановлен из WeSetup (${i.organization.name})`;

      // created_by_user_id = первый user в company (admin/owner если есть,
      // иначе любой). Через subselect в одной строке.
      lines.push(
        `INSERT INTO api_keys (name, key_hash, key_prefix, company_id, created_by_user_id, created_at) ` +
          `SELECT ${sqlString(name)}, ${sqlString(keyHash)}, ${sqlString(
            keyPrefix
          )}, ${companyId}, u.id, ${now} ` +
          `FROM users u WHERE u.company_id = ${companyId} ` +
          `ORDER BY (u.is_admin = 1) DESC, u.id ASC LIMIT 1 ` +
          `ON DUPLICATE KEY UPDATE last_used_at = last_used_at;`
      );
    } catch (err) {
      lines.push(
        `-- skipped ${i.organization.name}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  lines.push("COMMIT;");
  lines.push(
    "SELECT COUNT(*) AS total, COUNT(revoked_at) AS revoked FROM api_keys;"
  );
  console.log(lines.join("\n"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
