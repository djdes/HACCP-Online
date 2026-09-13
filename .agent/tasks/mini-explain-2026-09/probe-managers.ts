// Обратная проверка: руководители должны ОСТАТЬСЯ руководителями.
// Сравниваем старое правило (dashboard.view || staff.manage) с новым.
import { db } from "../partner-autonomy-2026-09/e2e/db";
import { isManagerLikePermissions, resolveActorPermissions } from "../../../src/lib/permissions";

async function main() {
  const users = await db.user.findMany({
    where: { isActive: true, role: { in: ["manager", "head_chef", "owner", "technologist"] } },
    take: 60,
    select: {
      name: true,
      role: true,
      permissionsJson: true,
      organization: { select: { name: true } },
      jobPosition: { select: { name: true, categoryKey: true, permissionsJson: true } },
    },
  });

  let before = 0;
  let after = 0;
  const regressions: string[] = [];

  for (const user of users) {
    const perms = resolveActorPermissions({
      isRoot: false,
      userPermissionsJson: user.permissionsJson,
      positionPermissionsJson: user.jobPosition?.permissionsJson ?? null,
      positionCategoryKey: user.jobPosition?.categoryKey ?? null,
      fallbackCategoryKey: "management",
    });
    const wasManager = perms.has("dashboard.view") || perms.has("staff.manage");
    const isManager = isManagerLikePermissions(perms);
    if (wasManager) before += 1;
    if (isManager) after += 1;
    if (wasManager && !isManager) {
      regressions.push(
        `${user.organization?.name ?? "—"} / ${user.name ?? "—"} (${user.role}, должность «${user.jobPosition?.name ?? "нет"}» ${user.jobPosition?.categoryKey ?? "—"})`,
      );
    }
  }

  console.log(`руководителей в выборке: ${users.length}`);
  console.log(`по старому правилу: ${before}`);
  console.log(`по новому правилу:  ${after}`);
  if (regressions.length) {
    console.log("\nПОТЕРЯЛИ режим руководителя:");
    for (const line of regressions) console.log("  -", line);
  } else {
    console.log("\nникто не потерял режим руководителя");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
