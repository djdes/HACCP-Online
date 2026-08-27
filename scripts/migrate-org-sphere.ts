/**
 * Переводит старые значения Organization.type в новые сферы.
 *
 * Колонка переиспользована: раньше в ней лежал «тип производства»
 * (meat, dairy, confectionery…), теперь — сфера заведения. Читающий код
 * умеет и то и другое через normalizeSphere, но держать в базе мусор
 * незачем: по нему строятся выборки в /root и подбор пресетов.
 *
 * Запуск:
 *   npx tsx scripts/migrate-org-sphere.ts           # только показать
 *   npx tsx scripts/migrate-org-sphere.ts --apply   # записать
 */
import { db } from "@/lib/db";
import { LEGACY_SPHERE_MAP, normalizeSphere } from "@/lib/org-profile";

const APPLY = process.argv.includes("--apply");

async function main() {
  // Платформенную организацию не трогаем: это служебная запись ROOT'а,
  // её `type = "platform"` — маркер, а не сфера заведения.
  const platformOrgId = (process.env.PLATFORM_ORG_ID ?? "platform").trim();
  const orgs = await db.organization.findMany({
    where: { id: { not: platformOrgId } },
    select: { id: true, name: true, type: true },
  });

  const plan = orgs
    .map((o) => ({ ...o, next: normalizeSphere(o.type) }))
    .filter((o) => o.next !== o.type);

  const byPair = new Map<string, number>();
  for (const o of plan) {
    const key = `${o.type} → ${o.next}`;
    byPair.set(key, (byPair.get(key) ?? 0) + 1);
  }

  console.log(`организаций всего: ${orgs.length}`);
  console.log(`нужно перевести:   ${plan.length}`);
  for (const [pair, count] of [...byPair].sort()) {
    console.log(`  ${pair.padEnd(28)} ${count}`);
  }
  const unknown = plan.filter(
    (o) => !(o.type in LEGACY_SPHERE_MAP) && o.next === "other",
  );
  if (unknown.length) {
    console.log(
      `\nне нашлось в карте (уйдут в «other»): ${unknown
        .map((o) => o.type)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(", ")}`,
    );
  }

  if (!APPLY) {
    console.log("\nDRY-RUN. Запустить с --apply, чтобы записать.");
    return;
  }

  for (const o of plan) {
    await db.organization.update({
      where: { id: o.id },
      data: { type: o.next },
    });
  }
  console.log(`\nобновлено: ${plan.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
