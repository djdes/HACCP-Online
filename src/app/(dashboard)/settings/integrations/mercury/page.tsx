import { redirect } from "next/navigation";

import { PageGuide } from "@/components/ui/page-guide";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuth } from "@/lib/auth-helpers";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { canUseMercury } from "@/lib/mercury/access";
import { resolveTransportMode } from "@/lib/mercury/transport";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

import { MercurySettingsClient } from "./mercury-settings-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Настройки ФГИС «Меркурий».
 *
 * Страница копирует форму `settings/integrations/tasksflow`, но с одним
 * принципиальным отличием: здесь НЕТ поля «API-ключ». APIKey выдаётся
 * один на информационную систему — то есть на весь WeSetup — и живёт в
 * env. От клиента нужны ГУИД его хозяйствующего субъекта и логин
 * уполномоченного лица, от чьего имени будут гаситься ВСД.
 */
export default async function MercurySettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/journals");

  const organizationId = getActiveOrgId(session);
  const [org, integration, buildings, users] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionPlan: true, isDemo: true, inn: true, name: true },
    }),
    db.mercuryIntegration.findUnique({
      where: { organizationId },
      select: {
        environment: true,
        issuerGuid: true,
        initiatorLogin: true,
        enabled: true,
        autoProcessMode: true,
        autoSupplierInns: true,
        notifyUserId: true,
        lastSyncAt: true,
        lastSyncError: true,
        label: true,
        // apiKeyEncrypted НЕ выбираем никогда — как в tasksflow-странице.
        enterprises: {
          select: {
            id: true,
            enterpriseGuid: true,
            activityLocationGuid: true,
            name: true,
            address: true,
            enabled: true,
            buildingId: true,
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { documents: true, outbox: true } },
      },
    }),
    db.building.findMany({
      where: { organizationId },
      select: { id: true, name: true, address: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.user.findMany({
      where: { organizationId, isActive: true, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  const available = canUseMercury({
    plan: org?.subscriptionPlan,
    isDemo: org?.isDemo,
  });
  const mode = resolveTransportMode({});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Интеграции"
        title="ФГИС «Меркурий»"
        description="Входящие ветеринарные документы приходят сами, приёмка и гашение — в одном окне."
      />

      <PageGuide
        title="Как подключить Меркурий"
        storageKey="settings-mercury-v1"
        bullets={[
          {
            title: "Найдите ГУИД хозяйствующего субъекта",
            body:
              "Кабинет Меркурия → «Хозяйствующий субъект». Это идентификатор вашей организации в реестре «Цербер», не секрет.",
          },
          {
            title: "Подайте заявку на присоединение к ИС WeSetup",
            body:
              "aplms.vetrf.ru — заявка подписывается ЭП руководителя, рассмотрение до пяти рабочих дней. APIKey получаем мы как информационная система, вам отдельный ключ не нужен.",
          },
          {
            title: "Укажите уполномоченное лицо",
            body:
              "Логин пользователя Меркурия, от чьего имени будут гаситься ВСД. Это юридически значимое действие, поэтому лицо должно быть уполномочено приказом.",
          },
          {
            title: "Сопоставьте площадки с точками",
            body:
              "У сети одна точка может иметь несколько площадок в Меркурии — склад и производство. Строка журнала приёмки попадёт в журнал той точки, с которой сопоставлена площадка.",
          },
        ]}
        qa={[
          {
            q: "Можно ли гасить ВСД автоматически?",
            a:
              "По умолчанию — нет, и мы советуем так и оставить. Система найдёт документ, посчитает срок, напомнит и заполнит строку журнала, но гасит человек кнопкой. Гашение — юридически значимое действие уполномоченного лица: если сделать его без физической приёмки, журнал входного контроля перестаёт быть доказательством. Полностью автоматический режим включается отдельно и работает только после того, как человек заполнил строку и поставил «принять», и только при полном совпадении объёма.",
          },
          {
            q: "Что будет, если Меркурий недоступен?",
            a:
              "Приёмка сохранится в журнале сразу — он наш собственный документ и от Ветис не зависит. Команда гашения встанет в очередь и уйдёт, когда шлюз ответит. Повторная отправка безопасна: если документ уже погашен, мы это распознаём и не гасим второй раз.",
          },
          {
            q: "За сколько нужно погасить входящий ВСД?",
            a:
              "В течение одного рабочего дня с момента поступления. Срок считается по производственному календарю РФ и часовому поясу организации, просроченные подсвечиваются красным, а руководству раз в сутки уходит напоминание.",
          },
        ]}
      />

      <MercurySettingsClient
        available={available}
        mode={mode}
        orgName={org?.name ?? ""}
        orgInn={org?.inn ?? null}
        integration={
          integration
            ? {
                environment: integration.environment,
                issuerGuid: integration.issuerGuid,
                initiatorLogin: integration.initiatorLogin,
                enabled: integration.enabled,
                autoProcessMode: integration.autoProcessMode,
                autoSupplierInns: Array.isArray(integration.autoSupplierInns)
                  ? (integration.autoSupplierInns as string[])
                  : [],
                notifyUserId: integration.notifyUserId,
                lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
                lastSyncError: integration.lastSyncError,
                label: integration.label,
                enterprises: integration.enterprises,
                documentsCount: integration._count.documents,
                queueCount: integration._count.outbox,
              }
            : null
        }
        buildings={buildings}
        users={users.map((u) => ({ id: u.id, name: u.name ?? "Без имени" }))}
      />
    </div>
  );
}
