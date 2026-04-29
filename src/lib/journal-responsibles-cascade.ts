import { db } from "@/lib/db";
import {
  getPrimarySlotId,
  getSchemaForJournal,
} from "@/lib/journal-responsible-schemas";

/**
 * Каскад изменений «ответственных за журнал» в реальные JournalDocument'ы
 * + сохранение per-slot user assignments в Organization JSON-поле.
 *
 * Что делает:
 *   1. Пишет JobPositionJournalAccess (eligibility должностей) — наружу.
 *   2. Сохраняет map { slotId → userId } в Organization.
 *      journalResponsibleUsersJson[code]. У каждого журнала своя
 *      схема слотов (см. journal-responsible-schemas.ts).
 *   3. Берёт PRIMARY-slot user и updateMany'ит на ВСЕХ активных
 *      документах этого журнала. Так в шапке printable-PDF и в
 *      JournalDocument.responsibleUserId сразу появляется ФИО.
 *
 * Если конкретные ФИО не переданы (slots = пустой объект) — для
 * primary-слота подбираем первого подходящего сотрудника из
 * выбранных positionIds (alphabetical) — старый «авто-подбор» эффект.
 */

export type SlotUserMap = Record<string, string | null>;

export async function cascadeResponsibleToActiveDocuments(input: {
  organizationId: string;
  templateId: string;
  journalCode: string;
  positionIds: string[];
  /** Карта slotId → userId. Если не передана — авто-подбор первого подходящего. */
  slotUsers?: SlotUserMap;
}): Promise<{
  documentsUpdated: number;
  pickedPrimaryUserId: string | null;
  savedSlots: SlotUserMap;
}> {
  const { organizationId, templateId, journalCode, positionIds } = input;
  const schema = getSchemaForJournal(journalCode);
  const primarySlotId = getPrimarySlotId(journalCode);
  const slotUsers: SlotUserMap = { ...(input.slotUsers ?? {}) };

  // 1. Авто-подбор по слотам, если ничего не задано.
  // Для каждого слота берём positionKeywords и фильтруем подходящих
  // в орге пользователей. Не дублируем — если slot1 уже взял Иванова,
  // slot2 ищет среди оставшихся.
  const usedUserIds = new Set<string>(
    Object.values(slotUsers).filter((v): v is string => Boolean(v))
  );

  for (const slot of schema.slots) {
    if (slotUsers[slot.id]) continue; // уже задано — оставляем
    const keywords = slot.positionKeywords ?? null;
    const where: Record<string, unknown> = {
      organizationId,
      isActive: true,
      archivedAt: null,
    };
    if (positionIds.length > 0) {
      where.jobPositionId = { in: positionIds };
    }
    const candidates = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        jobPosition: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    const matched = keywords
      ? candidates.filter((u) => {
          const positionName = (u.jobPosition?.name ?? "").toLowerCase();
          return keywords.some((kw) => positionName.includes(kw));
        })
      : candidates;
    const pick = matched.find((u) => !usedUserIds.has(u.id));
    if (pick) {
      slotUsers[slot.id] = pick.id;
      usedUserIds.add(pick.id);
    } else if (slot.primary || slot.id === primarySlotId) {
      // Primary слот не нашли с фильтром — берём любого без фильтра,
      // чтобы хоть кто-то был в шапке.
      const fallback = candidates.find((u) => !usedUserIds.has(u.id));
      if (fallback) {
        slotUsers[slot.id] = fallback.id;
        usedUserIds.add(fallback.id);
      }
    }
  }

  // 2. Сохраняем slot map в Organization.journalResponsibleUsersJson.
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { journalResponsibleUsersJson: true },
  });
  const allOrgSlots = (org?.journalResponsibleUsersJson ?? {}) as Record<
    string,
    SlotUserMap
  >;
  allOrgSlots[journalCode] = slotUsers;
  await db.organization.update({
    where: { id: organizationId },
    data: { journalResponsibleUsersJson: allOrgSlots as never },
  });

  // 3. Берём primary userId — это пойдёт в JournalDocument.responsibleUserId.
  const primaryUserId = slotUsers[primarySlotId] ?? null;
  if (!primaryUserId) {
    return {
      documentsUpdated: 0,
      pickedPrimaryUserId: null,
      savedSlots: slotUsers,
    };
  }

  // Доп. валидация — пользователь должен принадлежать орге.
  const owned = await db.user.findFirst({
    where: {
      id: primaryUserId,
      organizationId,
      isActive: true,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!owned) {
    return {
      documentsUpdated: 0,
      pickedPrimaryUserId: null,
      savedSlots: slotUsers,
    };
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
    data: { responsibleUserId: primaryUserId },
  });

  return {
    documentsUpdated: result.count,
    pickedPrimaryUserId: primaryUserId,
    savedSlots: slotUsers,
  };
}
