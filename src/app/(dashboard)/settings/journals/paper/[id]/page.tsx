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
 *
 * Сотрудники подставляются в строки заранее: колонки «ФИО» и «должность»
 * заполняются из карточек, остальное остаётся пустым. Переписывать
 * полтора десятка фамилий от руки в каждый из бумажных журналов — ровно
 * та работа, ради избавления от которой сервис и существует. Подписи,
 * даты и виды инструктажа НЕ трогаем: в бумажном журнале они живые, в
 * этом весь его смысл.
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

  const organizationId = getActiveOrgId(session);
  const [organization, employees] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, inn: true, address: true },
    }),
    db.user.findMany({
      where: { organizationId, isActive: true, archivedAt: null },
      select: {
        name: true,
        positionTitle: true,
        jobPosition: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Должность: справочник → вписанная руками → пусто. Роль («cook») в
  // бланк для проверки не подставляем — это техническая метка.
  const staff = employees.map((u) => ({
    name: u.name,
    title: u.jobPosition?.name?.trim() || u.positionTitle?.trim() || "",
  }));

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
        staff={staff}
      />
    </div>
  );
}
