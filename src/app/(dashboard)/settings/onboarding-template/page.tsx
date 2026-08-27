import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { ORG_TEMPLATES } from "@/lib/onboarding-templates";
import { OnboardingTemplateClient } from "@/components/settings/onboarding-template-client";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function OnboardingTemplatePage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");

  return (
    <div className="space-y-5">
      {/* Тёмный hero снят: он занимал первый экран и повторял название
          раздела из хлебных крошек PageNav. Строка-заголовок даёт то же
          объяснение, а карточки шаблонов видны сразу. */}
      <PageHeader
        title="Шаблоны заведений"
        description="Один клик — и у организации настроены: должности, помещения, оборудование, обязательные журналы. Сотрудников и их телефоны добавишь сам потом. Можно применять несколько шаблонов подряд — будет добавление, не замена."
      />

      <OnboardingTemplateClient templates={ORG_TEMPLATES} />
    </div>
  );
}
