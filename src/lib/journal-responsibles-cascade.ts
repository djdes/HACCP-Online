import { db } from "@/lib/db";

/**
 * Каскад изменений «ответственных за журнал» в реальные JournalDocument'ы.
 *
 * Когда админ на /settings/journal-responsibles задаёт должности и
 * (опционально) конкретного сотрудника для журнала, мы:
 *   1. Пишем JobPositionJournalAccess (eligibility для bulk-assign)
 *   2. Каскадим выбор в АКТИВНЫЕ документы этого журнала в орге —
 *      ставим doc.responsibleUserId, чтобы это сразу было видно в шапке
 *      печатной версии и в списке документов.
 *
 * Логика выбора responsibleUserId:
 *   • Если админ явно передал responsibleUserId — используем его.
 *   • Иначе подбираем первого активного сотрудника, чья должность
 *     входит в выбранные positionIds (alphabetical by name).
 *   • Если ни одного подходящего нет — оставляем как есть (не стираем
 *     существующего).
 */
export async function cascadeResponsibleToActiveDocuments(input: {
  organizationId: string;
  templateId: string;
  positionIds: string[];
  /** Конкретный сотрудник, если выбран. */
  responsibleUserId: string | null;
}): Promise<{ documentsUpdated: number; pickedUserId: string | null }> {
  const { organizationId, templateId, positionIds } = input;
  let { responsibleUserId } = input;

  // Если конкретный пользователь не указан — подбираем дефолт из
  // подходящих должностей. Это даёт «мгновенно появляется в документе»
  // эффект который и просил юзер.
  if (!responsibleUserId && positionIds.length > 0) {
    const candidate = await db.user.findFirst({
      where: {
        organizationId,
        isActive: true,
        archivedAt: null,
        jobPositionId: { in: positionIds },
      },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    responsibleUserId = candidate?.id ?? null;
  }

  if (!responsibleUserId) {
    return { documentsUpdated: 0, pickedUserId: null };
  }

  // Проверяем что выбранный юзер принадлежит этой орге (защита от
  // подмены id из другой орги через клиент).
  const owned = await db.user.findFirst({
    where: {
      id: responsibleUserId,
      organizationId,
      isActive: true,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!owned) {
    return { documentsUpdated: 0, pickedUserId: null };
  }

  const now = new Date();
  const result = await db.journalDocument.updateMany({
    where: {
      organizationId,
      templateId,
      status: "active",
      dateFrom: { lte: now },
      dateTo: { gte: now },
    },
    data: { responsibleUserId },
  });

  return {
    documentsUpdated: result.count,
    pickedUserId: responsibleUserId,
  };
}
