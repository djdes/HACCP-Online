import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { JournalAutoCreateToggle } from "@/components/journals/journal-auto-create-toggle";

/**
 * Общая полоса автоматизации над любым документом журнала.
 *
 * Тумблер «создавать журнал на новый период автоматически» раньше стоял
 * ровно в трёх клиентах — климат, холодильники, фритюр, — и в остальных
 * тридцати журналах человек про эту возможность просто не знал. Сам
 * механизм (`autoJournalCodes` + cron auto-create-journals) общий и
 * работает для любого кода, поэтому и место у переключателя одно: layout,
 * а не тридцать копий, которые разъедутся при первой же правке.
 *
 * Код шаблона берём из документа, а не из URL: у части журналов путь
 * отличается от кода шаблона, и запись в `autoJournalCodes` ушла бы под
 * несуществующим кодом.
 */
export default async function JournalDocumentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string; docId: string }>;
}) {
  const { docId } = await params;
  const session = await requireAuth();

  const document = await db.journalDocument
    .findFirst({
      where: { id: docId, organizationId: getActiveOrgId(session) },
      select: { status: true, template: { select: { code: true } } },
    })
    .catch(() => null);

  const templateCode = document?.template?.code ?? null;

  return (
    <>
      {templateCode ? (
        <div className="mb-3 print:hidden">
          <JournalAutoCreateToggle
            templateCode={templateCode}
            disabled={document?.status === "closed"}
          />
        </div>
      ) : null}
      {children}
    </>
  );
}
