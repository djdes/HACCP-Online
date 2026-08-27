import { notFound, redirect } from "next/navigation";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { paperJournalById } from "@/lib/sphere-journal-rules";
import { PageCrumbs } from "@/components/layout/page-nav";
import { PaperJournalEditor } from "./paper-journal-editor";

export const dynamic = "force-dynamic";

/**
 * Заполнение бумажного бланка перед печатью.
 *
 * Ничего не сохраняем в БД: журнал по закону живёт на бумаге с живой
 * подписью, а здесь мы лишь избавляем человека от рукописной шапки —
 * данные организации подставляются сами, строки печатаются ровно.
 */
export default async function PaperJournalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/dashboard");
  const { id } = await params;
  const journal = paperJournalById(id);
  if (!journal) notFound();

  const organization = await db.organization.findUnique({
    where: { id: getActiveOrgId(session) },
    select: { name: true, inn: true, address: true },
  });

  return (
    <div className="space-y-5">
      <PageCrumbs
        items={[
          { label: "Настройки", href: "/settings" },
          { label: "Набор журналов", href: "/settings/journals#paper" },
          { label: journal.name },
        ]}
      />
      <PaperJournalEditor
        journal={journal}
        organization={{
          name: organization?.name ?? "Организация",
          inn: organization?.inn ?? null,
          address: organization?.address ?? null,
        }}
      />
    </div>
  );
}
