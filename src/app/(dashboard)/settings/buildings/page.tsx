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
        storageKey="settings-buildings-v2"
        bullets={[
          { title: "Что здесь настраивается", body: "Корпуса (точки бизнеса) и помещения внутри них (горячий цех, холодный цех, бар, склад). Используются ТОЛЬКО для журнала уборки — каждое помещение = одна строка в матрице." },
          { title: "Это НЕ цеха для оборудования", body: "Холодильники и плиты привязываются к «Цехам и зонам» (другой раздел: /settings/areas). Не путайте — это две разные сущности по историческим причинам." },
          { title: "Минимум для уборки", body: "Один корпус + 2-3 помещения. Если у вас сеть — отдельный корпус на каждый адрес." },
        ]}
        qa={[
          { q: "А зачем тогда «Цеха и зоны»?", a: "Это legacy-сущность для оборудования и климата. Для уборки используются помещения отсюда. Думаем как объединить в будущем — пока две страницы." },
          { q: "Как помещения попадают в журнал уборки?", a: "Автоматически — при создании JournalDocument для cleaning система берёт ваши Building+Room и создаёт строки матрицы." },
        ]}
      />
      <BuildingsClient initial={buildings} />
    </div>
  );
}
