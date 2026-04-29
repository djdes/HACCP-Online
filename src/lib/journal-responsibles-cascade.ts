import { db } from "@/lib/db";
import {
  getPrimarySlotId,
  getSchemaForJournal,
} from "@/lib/journal-responsible-schemas";
import {
  hasDocumentConfigPatcher,
  patchDocumentConfig,
} from "@/lib/journal-responsibles-doc-patchers";

/**
 * Каскад изменений «ответственных за журнал» в реальные JournalDocument'ы
 * + сохранение per-slot user assignments в Organization JSON-поле.
 *
 * Что делает:
 *   1. Сохраняет map { slotId → userId } в Organization.
 *      journalResponsibleUsersJson[code]. У каждого журнала своя
 *      схема слотов (см. journal-responsible-schemas.ts).
 *   2. Патчит CONFIG активных документов через per-journal patcher
 *      (см. journal-responsibles-doc-patchers.ts) — это куда уходят
 *      специфичные для журнала поля типа approveEmployeeId,
 *      cleaningResponsibles[], commission и т.д.
 *   3. Берёт PRIMARY-slot user и updateMany'ит на ВСЕХ активных
 *      документах этого журнала.responsibleUserId — это шапка
 *      printable-PDF и общий «ответственный по умолчанию».
 *
 * Если конкретные ФИО не переданы (slots = пустой объект) — для
 * каждого слота подбираем подходящего сотрудника по schema.keywords,
 * без дубликатов между слотами одного журнала.
 */

export type SlotUserMap = Record<string, string | null>;

export async function cascadeResponsibleToActiveDocuments(input: {
  organizationId: string;
  templateId: string;
  journalCode: string;
  positionIds: string[];
  /** Карта slotId → userId. Если не передана — авто-подбор. */
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
  const usedUserIds = new Set<string>(
    Object.values(slotUsers).filter((v): v is string => Boolean(v))
  );

  for (const slot of schema.slots) {
    if (slotUsers[slot.id]) continue;
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

  // 3. Берём primary userId для responsibleUserId документа.
  const primaryUserId = slotUsers[primarySlotId] ?? null;

  if (!primaryUserId && !hasDocumentConfigPatcher(journalCode)) {
    return {
      documentsUpdated: 0,
      pickedPrimaryUserId: null,
      savedSlots: slotUsers,
    };
  }

  // Защита: проверяем что все попавшие в slots userId — реально из этой
  // орги. Иначе чисто отбрасываем.
  const userIdsToValidate = Object.values(slotUsers).filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  let validUserIds = new Set<string>();
  if (userIdsToValidate.length > 0) {
    const owned = await db.user.findMany({
      where: {
        id: { in: userIdsToValidate },
        organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true, name: true, jobPosition: { select: { name: true } } },
    });
    validUserIds = new Set(owned.map((u) => u.id));

    // Очищаем slotUsers от невалидных (мог быть архивный/из чужой орги
    // если кто-то прокинул из клиента).
    for (const [k, v] of Object.entries(slotUsers)) {
      if (v && !validUserIds.has(v)) slotUsers[k] = null;
    }

    // Patcher needs name+title — заведём lookup map.
    const userNameMap = new Map(owned.map((u) => [u.id, u.name] as const));
    const userPosMap = new Map(
      owned.map((u) => [u.id, u.jobPosition?.name ?? ""] as const)
    );

    // 4. Патчим document.config + ставим responsibleUserId.
    const now = new Date();
    const docs = await db.journalDocument.findMany({
      where: {
        organizationId,
        templateId,
        status: "active",
        dateFrom: { lte: now },
        dateTo: { gte: now },
      },
      select: { id: true, config: true },
    });

    let documentsUpdated = 0;
    for (const doc of docs) {
      const patched = hasDocumentConfigPatcher(journalCode)
        ? patchDocumentConfig(journalCode, doc.config, slotUsers, {
            getName: (id) => (id ? userNameMap.get(id) ?? "" : ""),
            getPositionTitle: (id) => (id ? userPosMap.get(id) ?? "" : ""),
          })
        : null;

      const data: Record<string, unknown> = {};
      if (primaryUserId && validUserIds.has(primaryUserId)) {
        data.responsibleUserId = primaryUserId;
      }
      if (patched) {
        data.config = patched as never;
      }
      if (Object.keys(data).length === 0) continue;

      await db.journalDocument.update({
        where: { id: doc.id },
        data,
      });
      documentsUpdated += 1;
    }

    return {
      documentsUpdated,
      pickedPrimaryUserId:
        primaryUserId && validUserIds.has(primaryUserId)
          ? primaryUserId
          : null,
      savedSlots: slotUsers,
    };
  }

  return {
    documentsUpdated: 0,
    pickedPrimaryUserId: null,
    savedSlots: slotUsers,
  };
}
