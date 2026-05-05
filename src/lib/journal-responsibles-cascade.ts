import { db } from "@/lib/db";
import {
  getPrimarySlotId,
  getSchemaForJournal,
  getVerifierSlotId,
} from "@/lib/journal-responsible-schemas";
import {
  hasDocumentConfigPatcher,
  patchDocumentConfig,
} from "@/lib/journal-responsibles-doc-patchers";
import {
  type DefaultConfigOrgData,
  getDefaultConfigForJournal,
} from "@/lib/journal-default-configs";

/**
 * Подтягивает org-данные (areas + equipment + users + products) для
 * enriched-дефолтов журналов. Используется prefill/cascade чтобы при
 * создании или backfill'е документа таблица сразу содержала реальные
 * цеха/оборудование/продукты, а не stub'ы.
 */
async function fetchOrgDataForDefaults(
  organizationId: string
): Promise<DefaultConfigOrgData> {
  const [areas, equipment, users, products] = await Promise.all([
    db.area.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.equipment.findMany({
      where: { area: { organizationId } },
      select: {
        id: true,
        name: true,
        type: true,
        tempMin: true,
        tempMax: true,
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { organizationId, isActive: true, archivedAt: null },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { areas, equipment, users, products };
}

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

export type CascadeScope =
  /** Только активный документ покрывающий сегодня (legacy default). */
  | "active-today"
  /** Все active документы независимо от периода. */
  | "active-any"
  /** Все документы — active И closed, любые периоды. Используется
   *  когда менеджер изменил ответственного и хочет переписать
   *  историю задним числом. UI требует подтверждение. */
  | "all";

export async function cascadeResponsibleToActiveDocuments(input: {
  organizationId: string;
  templateId: string;
  journalCode: string;
  positionIds: string[];
  /** Карта slotId → userId. Если не передана — авто-подбор. */
  slotUsers?: SlotUserMap;
  /** Какие документы каскадировать. По умолчанию active-today
   *  (back-compat). UI с двумя кнопками передаёт active-any для
   *  «изменить в активных» и all для «изменить во всех». */
  scope?: CascadeScope;
}): Promise<{
  documentsUpdated: number;
  pickedPrimaryUserId: string | null;
  savedSlots: SlotUserMap;
}> {
  const { organizationId, templateId, journalCode, positionIds } = input;
  const scope: CascadeScope = input.scope ?? "active-today";
  const schema = getSchemaForJournal(journalCode);
  const primarySlotId = getPrimarySlotId(journalCode);
  const verifierSlotId = getVerifierSlotId(journalCode);
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
    // Scope управляет какие документы попадают в каскад:
    //   • active-today — только active с покрытием сегодня (back-compat).
    //   • active-any   — все active.
    //   • all          — active + closed, любые периоды.
    // Last две опции используются когда менеджер хочет каскадно
    // переписать ответственного на старых документах (например,
    // уволили филлера → admin меняет старые записи на нового).
    const now = new Date();
    const todayUtcStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const docWhere: Record<string, unknown> = {
      organizationId,
      templateId,
    };
    if (scope === "active-today") {
      docWhere.status = "active";
      docWhere.dateFrom = { lte: todayUtcStart };
      docWhere.dateTo = { gte: todayUtcStart };
    } else if (scope === "active-any") {
      docWhere.status = "active";
    }
    // scope === "all" — без дополнительных where-клозов.
    const docs = await db.journalDocument.findMany({
      where: docWhere,
      select: { id: true, config: true },
    });

    // Если есть пустые конфиги — нужны org-данные для enriched дефолта
    // (см. prefill ниже). Тянем один раз, переиспользуем для всех docs.
    const hasEmptyConfigs = docs.some((d) => {
      const cfg =
        d.config && typeof d.config === "object" && !Array.isArray(d.config)
          ? (d.config as Record<string, unknown>)
          : {};
      return Object.keys(cfg).length === 0;
    });
    const cascadeOrgData = hasEmptyConfigs
      ? await fetchOrgDataForDefaults(organizationId)
      : undefined;

    let documentsUpdated = 0;
    for (const doc of docs) {
      // Если существующий config пустой ({}), подменяем дефолтным от
      // соответствующей default-функции, чтобы у документа появились
      // строки/зоны/оборудование. Это backfill для документов,
      // созданных ДО prefill-фикса. Не трогаем конфиги где уже есть
      // данные — иначе затрём пользовательские правки.
      const cfgObj =
        doc.config && typeof doc.config === "object" && !Array.isArray(doc.config)
          ? (doc.config as Record<string, unknown>)
          : {};
      const isEmpty = Object.keys(cfgObj).length === 0;
      const baseCfg = isEmpty
        ? getDefaultConfigForJournal(journalCode, cascadeOrgData)
        : cfgObj;

      const patched = hasDocumentConfigPatcher(journalCode)
        ? patchDocumentConfig(journalCode, baseCfg, slotUsers, {
            getName: (id) => (id ? userNameMap.get(id) ?? "" : ""),
            getPositionTitle: (id) => (id ? userPosMap.get(id) ?? "" : ""),
          })
        : null;

      const data: Record<string, unknown> = {};
      if (primaryUserId && validUserIds.has(primaryUserId)) {
        data.responsibleUserId = primaryUserId;
        // Также синхронизируем `responsibleTitle` (название должности
        // primary-сотрудника) — чтобы preview-карточка журнала на
        // /journals/<code> показывала «<position>: <name>», а не «—».
        // Без этого изменения в /settings/journal-responsibles обновляли
        // только userId — title оставался null/устаревший, и menager
        // видел «—» в preview.
        const primaryPosName = userPosMap.get(primaryUserId);
        if (primaryPosName) {
          data.responsibleTitle = primaryPosName;
        }
      }
      // Phase C: пишем verifierUserId если verifier-slot заполнен.
      // Если null — оставляем поле без change'а (legacy doc'и
      // продолжают работать через responsibleUserId fallback в
      // bulk-assign-today).
      const verifierUserId = slotUsers[verifierSlotId] ?? null;
      if (verifierUserId && validUserIds.has(verifierUserId)) {
        data.verifierUserId = verifierUserId;
      } else if (input.slotUsers && verifierSlotId in input.slotUsers) {
        // Юзер явно очистил verifier slot — пишем null чтобы убрать.
        data.verifierUserId = null;
      }
      if (patched) {
        data.config = patched as never;
      } else if (isEmpty && Object.keys(baseCfg).length > 0) {
        // Patcher отсутствует, но дефолт для журнала есть — записываем
        // его, чтобы документ перестал быть пустым.
        data.config = baseCfg as never;
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

/**
 * Используется при СОЗДАНИИ нового JournalDocument'а (auto-create cron,
 * bulk-assign фан-аут, ручное создание на /journals/[code]). Подтягивает
 * сохранённых в /settings/journal-responsibles слот-юзеров и патчит
 * config + возвращает primary userId.
 *
 * Не пишет в БД — caller сам кладёт результат в `data` для create.
 *
 * Использование:
 *   const filled = await prefillResponsiblesForNewDocument({
 *     organizationId, journalCode, baseConfig
 *   });
 *   await db.journalDocument.create({
 *     data: {
 *       ...,
 *       config: filled.config,
 *       responsibleUserId: filled.responsibleUserId,
 *     },
 *   });
 */
export async function prefillResponsiblesForNewDocument(input: {
  organizationId: string;
  journalCode: string;
  baseConfig?: Record<string, unknown>;
}): Promise<{
  config: Record<string, unknown>;
  responsibleUserId: string | null;
  /** Phase C: verifier для нового документа. Caller передаёт в
   *  JournalDocument.verifierUserId при db.create. */
  verifierUserId: string | null;
}> {
  const { organizationId, journalCode } = input;
  // Если caller передал baseConfig — уважаем его. Иначе берём дефолт
  // для журнала: для cleaning — массивы responsibles, для climate —
  // точки контроля, для general_cleaning — список помещений и т.д.
  // Без этого многие документы создавались с {} → bulk-assign-today
  // потом сообщал «у журнала нет строк для назначения».
  //
  // Подтягиваем реальные areas/equipment/products орги, чтобы для
  // climate появились rooms по цехам, для cold-equipment — все
  // холодильники, для glass-list — оборудование/продукты, для
  // equipment-calibration — список оборудования. Без этого при
  // создании нового документа таблица была пустой и менеджеру
  // приходилось вручную добавлять каждую строку.
  const orgData =
    input.baseConfig && Object.keys(input.baseConfig).length > 0
      ? undefined
      : await fetchOrgDataForDefaults(organizationId);
  const baseConfig =
    input.baseConfig && Object.keys(input.baseConfig).length > 0
      ? input.baseConfig
      : getDefaultConfigForJournal(journalCode, orgData);

  // 1. Читаем сохранённые слоты из Organization JSON.
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { journalResponsibleUsersJson: true },
  });
  const allSlots = (org?.journalResponsibleUsersJson ?? {}) as Record<
    string,
    SlotUserMap
  >;
  const slots: SlotUserMap = { ...(allSlots[journalCode] ?? {}) };

  // 2. Если в orgSlots ничего нет — попробуем подобрать на лету через
  // schema.keywords по активным сотрудникам с подходящими должностями.
  // (Стандартная ситуация: новая орга, ещё не заходила в settings.)
  const schema = getSchemaForJournal(journalCode);
  const usedIds = new Set<string>(
    Object.values(slots).filter((v): v is string => Boolean(v))
  );
  for (const slot of schema.slots) {
    if (slots[slot.id]) continue;
    const where: Record<string, unknown> = {
      organizationId,
      isActive: true,
      archivedAt: null,
    };
    const candidates = await db.user.findMany({
      where,
      select: { id: true, jobPosition: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    const matched = slot.positionKeywords?.length
      ? candidates.filter((u) => {
          const n = (u.jobPosition?.name ?? "").toLowerCase();
          return slot.positionKeywords!.some((kw) => n.includes(kw));
        })
      : candidates;
    const pick = matched.find((u) => !usedIds.has(u.id));
    if (pick) {
      slots[slot.id] = pick.id;
      usedIds.add(pick.id);
    }
  }

  const primarySlotId = getPrimarySlotId(journalCode);
  const verifierSlotId = getVerifierSlotId(journalCode);
  const primaryUserId = slots[primarySlotId] ?? null;
  const verifierRawUserId = slots[verifierSlotId] ?? null;

  // 3. Валидация — оставляем только реально-существующих в орге.
  const userIdsToCheck = Object.values(slots).filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  let validUserIds = new Set<string>();
  let userNameMap = new Map<string, string>();
  let userPosMap = new Map<string, string>();
  if (userIdsToCheck.length > 0) {
    const owned = await db.user.findMany({
      where: {
        id: { in: userIdsToCheck },
        organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true, name: true, jobPosition: { select: { name: true } } },
    });
    validUserIds = new Set(owned.map((u) => u.id));
    userNameMap = new Map(owned.map((u) => [u.id, u.name] as const));
    userPosMap = new Map(
      owned.map((u) => [u.id, u.jobPosition?.name ?? ""] as const)
    );
    for (const [k, v] of Object.entries(slots)) {
      if (v && !validUserIds.has(v)) slots[k] = null;
    }
  }

  // 4. Патчим config через journal-specific patcher.
  let config = baseConfig;
  if (hasDocumentConfigPatcher(journalCode)) {
    const patched = patchDocumentConfig(journalCode, baseConfig, slots, {
      getName: (id) => (id ? userNameMap.get(id) ?? "" : ""),
      getPositionTitle: (id) => (id ? userPosMap.get(id) ?? "" : ""),
    });
    if (patched) config = patched;
  }

  return {
    config,
    responsibleUserId:
      primaryUserId && validUserIds.has(primaryUserId) ? primaryUserId : null,
    verifierUserId:
      verifierRawUserId && validUserIds.has(verifierRawUserId)
        ? verifierRawUserId
        : null,
  };
}
