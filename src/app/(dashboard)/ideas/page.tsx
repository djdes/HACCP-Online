import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

import { IdeasClient } from "./ideas-client";

export const dynamic = "force-dynamic";

/**
 * Идеи и голосование: общая площадка всех клиентов. Руководители
 * предлагают и голосуют, статусы ставит команда WeSetup.
 */
export default async function IdeasPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/journals");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Идеи и голосование"
        description="Чего не хватает в WeSetup? Предложите — или поддержите чужую идею голосом. Что набирает голоса, попадает в план; что вышло — на wesetup.ru/whats-new."
      />
      <IdeasClient />
    </div>
  );
}
