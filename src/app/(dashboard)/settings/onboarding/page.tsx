import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { OnboardingWizard } from "@/components/settings/onboarding-wizard";

export const dynamic = "force-dynamic";

/**
 * Onboarding-wizard: 3 шага для новой компании, чтобы за 5 минут
 * получить «настроенный» режим. Доступен в любое время — но
 * максимально полезен сразу после регистрации.
 *
 * Шаги:
 *   1. Применить шаблон должностей и журналов под type организации.
 *   2. Импорт сотрудников (CSV или paste из Excel).
 *   3. Подключить TasksFlow (или пропустить).
 */
export default async function OnboardingPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/settings");
  const organizationId = getActiveOrgId(session);

  const [org, integration, positionsCount, staffCount] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { type: true, name: true },
    }),
    db.tasksFlowIntegration.findFirst({
      where: { organizationId, enabled: true },
      select: { id: true, label: true, baseUrl: true },
    }),
    db.jobPosition.count({ where: { organizationId } }),
    db.user.count({
      where: { organizationId, isActive: true, archivedAt: null },
    }),
  ]);

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
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Быстрая настройка компании
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              За 3 шага: должности по типу «{org?.type ?? "other"}», импорт
              сотрудников и подключение TasksFlow. Идемпотентно — каждый
              шаг можно пройти повторно без побочных эффектов.
            </p>
          </div>
        </div>
      </div>

      <OnboardingWizard
        orgType={org?.type ?? "other"}
        orgName={org?.name ?? "Моя компания"}
        initialPositionsCount={positionsCount}
        initialStaffCount={staffCount}
        tasksflowConnected={Boolean(integration)}
      />
    </div>
  );
}
