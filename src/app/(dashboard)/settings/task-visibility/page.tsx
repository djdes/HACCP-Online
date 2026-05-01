import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { TaskVisibilityClient } from "@/components/settings/task-visibility-client";
import { PageGuide } from "@/components/ui/page-guide";

export const dynamic = "force-dynamic";

export default async function TaskVisibilityPage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");
  const organizationId = getActiveOrgId(session);

  const positions = await db.jobPosition.findMany({
    where: { organizationId },
    orderBy: [
      { categoryKey: "asc" },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      categoryKey: true,
      seesAllTasks: true,
      _count: {
        select: { users: { where: { isActive: true, archivedAt: null } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К настройкам
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Eye className="size-6" />
            </span>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                Видимость чужих задач
              </h1>
              <p className="mt-2 max-w-[680px] text-[14px] text-white/70">
                Кто из руководства видит ВСЕ задачи в TasksFlow (admin-
                режим). По умолчанию — никто. Включай только для
                должностей которые реально проверяют работу других.
                Каждый сотрудник у которого функция выключена — видит
                только свои задачи.
              </p>
            </div>
          </div>
        </div>
      </section>

      <PageGuide
        storageKey="task-visibility"
        title="Как это работает"
        bullets={[
          {
            title: "По умолчанию — никто",
            body: "При создании организации ни одна должность не видит чужие задачи. Это правильно по принципу least-privilege.",
          },
          {
            title: "Включи одну должность",
            body: "Обычно достаточно одной — «Админ» или «Владелец». Они получат admin-флаг в TasksFlow и увидят весь состав задач.",
          },
          {
            title: "Заведующая и менеджеры — НЕ нужно",
            body: "Они проверяют только своих подчинённых через иерархию (/settings/staff-hierarchy). Видеть ВСЕ задачи им не нужно — это нарушает приватность сотрудников.",
          },
          {
            title: "Применяется при синхронизации",
            body: "После сохранения настройки запусти синхронизацию TasksFlow в /settings/integrations/tasksflow или нажми «Отправить задачи на заполнение» — sync поставит isAdmin=true в TF для нужных юзеров.",
          },
        ]}
        qa={[
          {
            q: "Что произойдёт если я отметил должность но потом снял?",
            a: "При следующей синхронизации isAdmin=true перепишется на false (точнее, юзеры этой должности перестанут получать promote). TF сразу сузит им видимость до собственных задач.",
          },
          {
            q: "Если ни одна должность не отмечена — вообще никто не видит?",
            a: "Для back-compat (старые орги) если ничего не настроено, fallback на legacy: первый зарегистрированный management-юзер автоматом становится admin TF. Как только ты отметишь хотя бы одну должность здесь — fallback отключается, действует только твой выбор.",
          },
        ]}
      />

      <TaskVisibilityClient
        positions={positions.map((p) => ({
          id: p.id,
          name: p.name,
          categoryKey: p.categoryKey,
          seesAllTasks: p.seesAllTasks,
          activeUsers: p._count.users,
        }))}
      />
    </div>
  );
}
