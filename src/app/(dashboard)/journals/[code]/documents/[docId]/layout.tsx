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
    // На мобильном страница документа едет вбок ЦЕЛИКОМ: крошки, заголовок,
    // кнопки, шапка бланка, таблицы и легенда — одним листом. Тянешь в
    // любом месте, и всё двигается вместе.
    //
    // Скроллер обязан быть во всю ширину экрана: `-mx-4` гасит `px-4`
    // родителя, `w-screen` растягивает до краёв, внутренний `px-4`
    // возвращает поля. Без этого он оказывался узким окном внутри
    // отступов — таблица уезжала за его край и выглядела обрезанной.
    //
    // Сама страница вбок не скроллится: у `body` стоит overflow-x: clip
    // ради full-bleed белой подложки раздела.
    <div className="max-sm:-mx-4 max-sm:w-screen max-sm:overflow-x-auto max-sm:px-4">
      {templateCode ? (
        <div className="mb-3 print:hidden">
          <JournalAutoCreateToggle
            templateCode={templateCode}
            disabled={document?.status === "closed"}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
