import { redirect } from "next/navigation";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { BuildingsClient } from "./buildings-client";
import { PageGuide } from "@/components/ui/page-guide";

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
      <PageGuide
        title="Как настроить здания и помещения"
        storageKey="settings-buildings-v1"
        bullets={[
          { title: "Создайте корпус", body: "Если у вас одна точка — назовите её, например, «Главная кухня». Если несколько (сеть кафе) — заведите по одному корпусу на каждый адрес." },
          { title: "Внутри каждого — помещения", body: "Холодный цех, горячий цех, склад, бар, моечная. Каждое помещение станет строкой в журналах уборки и температурного режима." },
          { title: "Без помещений не работает оборудование", body: "Холодильники и плиты привязываются к помещению. Сначала помещение → потом оборудование." },
        ]}
        qa={[
          { q: "Я только настраиваю — какой минимум?", a: "Один корпус «Главное» + 2-3 помещения (горячий цех, холодный цех, склад). Этого хватит чтобы запустить уборку и температурный режим." },
          { q: "Как помещения попадают в журналы?", a: "Автоматически — при создании журнала уборки или температуры система берёт активные помещения этой организации и создаёт строки." },
        ]}
      />
      <BuildingsClient initial={buildings} />
    </div>
  );
}
