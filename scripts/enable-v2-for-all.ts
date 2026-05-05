/**
 * One-off: включает Design v2 для всех существующих орг. Prisma-default
 * с 2026-05 = true, но existing rows нужно обновить отдельно (db push
 * не трогает существующие данные при изменении дефолта). Идемпотентно.
 */
import { db } from "../src/lib/db";

async function main() {
  const total = await db.organization.count();
  const legacy = await db.organization.count({
    where: { experimentalUiV2: false },
  });
  console.log(`Orgs total: ${total}, on legacy v1: ${legacy}`);
  if (legacy === 0) {
    console.log("Nothing to update — все уже на v2.");
    return;
  }
  const r = await db.organization.updateMany({
    where: { experimentalUiV2: false },
    data: { experimentalUiV2: true },
  });
  console.log(`Updated ${r.count} orgs to v2.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
