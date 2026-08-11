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
        select: {
          id: true,
          name: true,
          kind: true,
          sortOrder: true,
          // Cleaning unification 2026-05-08: Room теперь хранит scope/days/
          // detergent — RoomEditorDialog в buildings-client использует.
          detergent: true,
          currentScope: true,
          generalScope: true,
          currentDays: true,
          generalDays: true,
          currentScheduleType: true,
          generalScheduleType: true,
          currentMonthDays: true,
          generalMonthDays: true,
          requirePhoto: true,
        },
      },
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[clamp(1.75rem,2vw+1rem,2rem)] leading-tight font-bold tracking-[-0.02em] text-[#0b1024]">
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
        storageKey="settings-buildings-v3"
        bullets={[
          { title: "Это единое место для цехов", body: "Корпуса (точки бизнеса) и помещения внутри них — горячий цех, холодный цех, бар, склад. Используются и в журнале уборки (как строки матрицы), и для привязки оборудования. Не нужно дублировать в /settings/areas — мы автоматически создаём «Цех» с тем же именем." },
          { title: "Минимум для запуска", body: "1 корпус + 2-3 помещения. Если у вас сеть — отдельный корпус на каждый адрес. Если одна точка — назовите корпус «Главное»." },
          { title: "После создания всё подтянется", body: "Помещения автоматически появятся в /settings/equipment (когда добавляете холодильник — выбираете цех из списка) и в журнале уборки (новый документ автоматически разлинует матрицу по вашим помещениям)." },
        ]}
        qa={[
          { q: "Зачем тогда есть /settings/areas?", a: "Legacy-страница для прямого редактирования цехов (Area). Обычно туда заходить не нужно — всё авто-создаётся отсюда. Оставлена для тех у кого был старый flow." },
          { q: "Что если я создал и в Buildings и в Areas?", a: "Будут оба — Equipment dropdown покажет всё. Дубликаты не страшны, но захламляют список. Удалить лишнее можно в /settings/areas." },
        ]}
      />
      <BuildingsClient initial={buildings} />
    </div>
  );
}
