import { JournalsBrowser } from "@/components/journals/journals-browser";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { aclActorFromSession, getAllowedJournalCodes } from "@/lib/journal-acl";
import { getJournalTariff, getJournalTariffSortOrder } from "@/lib/journal-tariffs";

export default async function JournalsPage() {
  const session = await requireAuth();

  const allowedCodes = await getAllowedJournalCodes(
    aclActorFromSession(session)
  );

  const [templates, organization] = await Promise.all([
    db.journalTemplate.findMany({
      where: {
        isActive: true,
        ...(allowedCodes ? { code: { in: allowedCodes } } : {}),
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { subscriptionPlan: true },
    }),
  ]);

  const annotated = templates
    .map((template) => ({
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      isMandatorySanpin: template.isMandatorySanpin,
      isMandatoryHaccp: template.isMandatoryHaccp,
      tariff: getJournalTariff(template.code),
      tariffOrder: getJournalTariffSortOrder(template.code),
    }))
    .sort((a, b) => a.tariffOrder - b.tariffOrder);

  return (
    <JournalsBrowser
      templates={annotated}
      subscriptionPlan={organization?.subscriptionPlan ?? "trial"}
    />
  );
}
