import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

import { WebhooksClient } from "./webhooks-client";

export const dynamic = "force-dynamic";

/** Исходящие вебхуки: подписки на события, подпись, повторы, журнал доставок. */
export default async function WebhooksSettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/journals");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Вебхуки"
        description="WeSetup сам присылает события на ваш сервер: записи в журналах, отклонения температуры, задачи CAPA, оплаты, статусы идей. Каждый вызов подписан вашим секретом, неудачные доставки повторяются."
      />
      <WebhooksClient />
    </div>
  );
}
