import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { TasksFlowSettingsClient } from "./tasksflow-settings-client";
import { PageGuide } from "@/components/ui/page-guide";

export const dynamic = "force-dynamic";

export default async function TasksFlowSettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/journals");
  }
  const orgId = getActiveOrgId(session);

  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId: orgId },
    select: {
      id: true,
      baseUrl: true,
      apiKeyPrefix: true,
      tasksflowCompanyId: true,
      enabled: true,
      lastSyncAt: true,
      label: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { links: true, taskLinks: true } },
    },
  });

  return (
    <div className="space-y-5">
      <PageGuide
        title="Как подключить TasksFlow"
        storageKey="settings-tasksflow-v1"
        bullets={[
          { title: "Получите API-ключ", body: "В админке TasksFlow → Интеграции → Создать API-токен. Скопируйте + укажите base URL вашего инстанса." },
          { title: "Свяжите сотрудников", body: "После подключения откроется список ваших сотрудников и команды TasksFlow. Связывайте по совпадению ФИО или телефона." },
          { title: "Задачи начнут разлетаться", body: "После связки каждое утро WeSetup отправляет в TasksFlow задачи на день: «Заполни журнал X». Сотрудник видит push в Telegram." },
        ]}
        qa={[
          { q: "Что такое verifierWorkerId?", a: "Это сотрудник, который проверяет заполненный журнал — двухступенчатая проверка. Настраивается в /settings/journal-responsibles, слот «Проверяет»." },
          { q: "Можно без TasksFlow?", a: "Да — используйте Telegram-бота WeSetup (/settings/users → инвайт). Сотрудник заполняет журналы прямо в Mini App." },
        ]}
      />
      <TasksFlowSettingsClient
      organizationName={session.user.organizationName ?? ""}
      initialIntegration={
        integration
          ? {
              id: integration.id,
              baseUrl: integration.baseUrl,
              apiKeyPrefix: integration.apiKeyPrefix,
              tasksflowCompanyId: integration.tasksflowCompanyId,
              enabled: integration.enabled,
              lastSyncAt: integration.lastSyncAt
                ? integration.lastSyncAt.toISOString()
                : null,
              label: integration.label,
              linkedUserCount: integration._count.links,
              taskLinkCount: integration._count.taskLinks,
            }
          : null
      }
    />
    </div>
  );
}
