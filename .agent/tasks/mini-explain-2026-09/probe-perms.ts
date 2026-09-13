// Какие права реально получают линейные сотрудники: от этого зависит,
// какой экран им отдаёт /api/mini/home (manager | staff | readonly).
import { db } from "../partner-autonomy-2026-09/e2e/db";
import { isManagerLikePermissions, resolveActorPermissions } from "../../../src/lib/permissions";

async function main() {
  const users = await db.user.findMany({
    where: { isActive: true, role: { in: ["cook", "waiter", "cleaner", "operator"] } },
    take: 25,
    select: {
      name: true,
      role: true,
      permissionsJson: true,
      organization: { select: { name: true } },
      jobPosition: { select: { name: true, categoryKey: true, permissionsJson: true } },
    },
  });

  let managerLike = 0;
  for (const user of users) {
    const perms = resolveActorPermissions({
      isRoot: false,
      userPermissionsJson: user.permissionsJson,
      positionPermissionsJson: user.jobPosition?.permissionsJson ?? null,
      positionCategoryKey: user.jobPosition?.categoryKey ?? null,
      fallbackCategoryKey: "staff",
    });
    const isManagerLike = isManagerLikePermissions(perms);
    if (isManagerLike) managerLike += 1;
    console.log(
      [
        (user.organization?.name ?? "—").slice(0, 22).padEnd(22),
        (user.name ?? "—").slice(0, 20).padEnd(20),
        user.role.padEnd(9),
        `должность=${user.jobPosition?.name ?? "нет"} (${user.jobPosition?.categoryKey ?? "—"})`.padEnd(38),
        `свои права=${user.permissionsJson ? "да" : "нет"}`.padEnd(16),
        `права должности=${user.jobPosition?.permissionsJson ? "да" : "нет"}`.padEnd(22),
        isManagerLike ? "→ РЕЖИМ РУКОВОДИТЕЛЯ" : "→ режим сотрудника",
      ].join(" "),
    );
  }
  console.log(`\nиз ${users.length}: режим руководителя у ${managerLike}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
