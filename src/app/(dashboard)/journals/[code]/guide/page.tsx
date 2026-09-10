import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { JournalGuide } from "@/components/journals/journal-guide";
import { PrintJournalButton } from "@/components/journals/print-journal-button";
import { JournalPageCrumbs } from "@/components/journals/journal-breadcrumbs";
import { getJournalCrumbMenu } from "@/lib/journal-crumb-menu";
import { ORG_NAME_FALLBACK } from "@/lib/journal-constants";
import { resolveJournalCodeAlias } from "@/lib/source-journal-map";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { loadGuideNodesForUI } from "@/lib/journal-guide-tree";
import { hasDocumentFillUi } from "@/lib/journal-document-helpers";
import { isScanOnlyDocumentTemplate } from "@/lib/scan-journal-config";

export const dynamic = "force-dynamic";

export default async function JournalGuidePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const resolvedCode = resolveJournalCodeAlias(code);

  const template = await db.journalTemplate.findUnique({
    where: { code: resolvedCode },
    select: { name: true, description: true },
  });
  if (!template) notFound();

  // P1.5 wave-c — загружаем кастомный гайд организации (если есть).
  // Если orga настроила в /settings/journal-guides-tree — он
  // переопределяет hardcoded `journal-filling-guides.steps[]`.
  const session = await getServerSession(authOptions);
  const [customNodes, organization] = await Promise.all([
    session
      ? loadGuideNodesForUI(getActiveOrgId(session), resolvedCode).then(
          (nodes) => nodes ?? undefined
        )
      : Promise.resolve(undefined),
    session
      ? db.organization.findUnique({
          where: { id: getActiveOrgId(session) },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const journalMenu = session
    ? await getJournalCrumbMenu(session, resolvedCode)
    : undefined;

  // «К заполнению» у document-журналов ведёт в список документов: у них
  // нет формы /new (new/page.tsx отдаёт 404), заполнение идёт в таблице.
  const fillHref =
    hasDocumentFillUi(resolvedCode) || isScanOnlyDocumentTemplate(resolvedCode)
      ? `/journals/${resolvedCode}`
      : `/journals/${resolvedCode}/new`;

  const organizationName = organization?.name || ORG_NAME_FALLBACK;

  return (
    <div
      data-guide-print
      className="mx-auto max-w-3xl space-y-5 px-1 sm:space-y-6"
    >
      {/* Печатная шапка: на бумаге не видно ни крошек, ни шапки сайта,
          и лист без названия организации превращается в анонимную
          распечатку, которую не подошьёшь к документации. */}
      <div className="hidden print:block">
        <div className="text-[15px] font-semibold text-black">
          {organizationName}
        </div>
        <div className="mt-1 text-[13px] text-black">
          Инструкция по заполнению: {template.name}
        </div>
        <div className="mt-3 border-b border-black" />
      </div>

      <JournalPageCrumbs
        organizationName={organizationName}
        journalName={template.name}
        journalCode={resolvedCode}
        journalMenu={journalMenu}
        tail={[{ label: "Инструкция" }]}
      />

      {/* Тёмный hero снят: инструкцию читают перед сменой, и полезный
          текст должен начинаться сразу, а не под баннером. */}
      <PageHeader
        eyebrow="Инструкция для нового сотрудника"
        title={template.name}
        description="Прочитай эту страницу до того как начнёшь заполнять журнал. Она объясняет шаги, что взять с собой, типичные ошибки и требования СанПиН."
        actions={
          <>
            {/* Инструкцию вешают на стену и выдают новичку на смену —
                без печати страница остаётся только «прочитать с экрана». */}
            <PrintJournalButton label="Распечатать" />
            <Link
              href={fillHref}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
            >
              К заполнению →
            </Link>
          </>
        }
      />

      <JournalGuide
        journalCode={resolvedCode}
        expanded={true}
        customNodes={customNodes}
      />
    </div>
  );
}
