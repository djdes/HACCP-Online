// Полный срез: у кого меняется экран Mini App после правки признака.
import { db } from "../partner-autonomy-2026-09/e2e/db";
import { isManagerLikePermissions, resolveActorPermissions } from "../../../src/lib/permissions";
import { isManagementRole } from "../../../src/lib/user-roles";

async function main() {
  const users = await db.user.findMany({
    where: { isActive: true, archivedAt: null },
    select: {
      id: true,
      name: true,
      role: true,
      isRoot: true,
      permissionsJson: true,
      organization: { select: { name: true } },
      jobPosition: { select: { name: true, categoryKey: true, permissionsJson: true } },
    },
  });

  let staffFixed = 0;
  let managersKept = 0;
  const lostManager: string[] = [];

  for (const user of users) {
    if (user.isRoot) continue;
    const perms = resolveActorPermissions({
      isRoot: false,
      userPermissionsJson: user.permissionsJson,
      positionPermissionsJson: user.jobPosition?.permissionsJson ?? null,
      positionCategoryKey: user.jobPosition?.categoryKey ?? null,
      fallbackCategoryKey: isManagementRole(user.role) ? "management" : "staff",
    });
    const was = perms.has("dashboard.view") || perms.has("staff.manage");
    const now = isManagerLikePermissions(perms, user.role);
    if (was && now) managersKept += 1;
    if (was && !now) {
      if (isManagementRole(user.role)) {
        lostManager.push(
          `${user.organization?.name ?? "—"} / ${user.name ?? "—"} (${user.role}, «${user.jobPosition?.name ?? "нет"}» ${user.jobPosition?.categoryKey ?? "—"})`,
        );
      } else {
        staffFixed += 1;
      }
    }
  }

  console.log(`всего активных (без ROOT): ${users.filter((u) => !u.isRoot).length}`);
  console.log(`линейных, которым чинится экран: ${staffFixed}`);
  console.log(`сохранили режим руководителя:    ${managersKept}`);
  console.log(`руководителей, потерявших режим: ${lostManager.length}`);
  for (const line of lostManager.slice(0, 20)) console.log("  -", line);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
