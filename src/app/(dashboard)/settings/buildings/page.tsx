import { redirect } from "next/navigation";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { BuildingsClient } from "./buildings-client";

export const dynamic = "force-dynamic";

export default async function BuildingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/journals");
  const orgId = getActiveOrgId(session);

  const buildings = await db.building.findMany({
    where: { organizationId: orgId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      rooms: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, kind: true, sortOrder: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Здания и помещения
        </h1>
        <p className="mt-1.5 max-w-[640px] text-[14px] leading-[1.6] text-[#6f7282]">
          Заведите корпуса (точки бизнеса) и помещения внутри них. По
          помещениям дальше будут раздаваться задачи в журналах уборки —
          одна задача на помещение в день, кто первый из уборщиков
          выполнит, тот и закрепит за собой.
        </p>
      </div>
      <BuildingsClient initial={buildings} />
    </div>
  );
}
