import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { getActiveBuildingId } from "@/lib/active-building";
import { buildingWhere } from "@/lib/building-scope";
import { db } from "@/lib/db";
import {
  buildColdEquipmentConfigFromEquipment,
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
} from "@/lib/cold-equipment-document";
import {
  CONTROL_PERIODICITY_CONFIG_KEY,
  sanitizeControlPeriodicity,
} from "@/lib/control-periodicity";
import {
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  buildClimateConfigFromRooms,
  getDefaultClimateDocumentConfig,
} from "@/lib/climate-document";
import {
  applyRoomScheduleToMatrix,
  applyRoomsToCleaningConfig,
  toRoomScheduleMap,
  applyWeekendHolidayMark,
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  copyMatrixByWeekday,
  defaultCleaningDocumentConfig,
  getDefaultCleaningResponsibleIds,
  normalizeCleaningDocumentConfig,
  stripPeriodSpecificCleaningFields,
  type CleaningMatrixMap,
} from "@/lib/cleaning-document";
import { buildDateKeys } from "@/lib/hygiene-document";
import { buildDocumentAutoTitle } from "@/lib/journal-document-title";
import {
  FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE,
  buildFinishedProductConfigFromUsers,
} from "@/lib/finished-product-document";
import {
  PRODUCT_WRITEOFF_TEMPLATE_CODE,
  buildProductWriteoffConfigFromData,
} from "@/lib/product-writeoff-document";
import {
  GLASS_LIST_TEMPLATE_CODE,
  buildGlassListConfigFromData,
} from "@/lib/glass-list-document";
import { getHygienePositionLabel } from "@/lib/hygiene-document";
import {
  getAcceptanceDocumentDefaultConfig,
  isAcceptanceDocumentTemplate,
} from "@/lib/acceptance-document";
import {
  PPE_ISSUANCE_TEMPLATE_CODE,
  getPpeIssuanceDefaultConfig,
} from "@/lib/ppe-issuance-document";
import {
  SANITATION_DAY_TEMPLATE_CODE,
  buildSanitationDayConfigFromRooms,
  normalizeSanitationDayConfig,
} from "@/lib/sanitation-day-document";
import {
  buildRegisterDocumentConfigFromUsers,
  isRegisterDocumentTemplate,
} from "@/lib/register-document";
import { TRAINING_PLAN_TEMPLATE_CODE, getTrainingPlanDefaultConfig } from "@/lib/training-plan-document";
import { BREAKDOWN_HISTORY_TEMPLATE_CODE, getBreakdownHistoryDefaultConfig } from "@/lib/breakdown-history-document";
import {
  ACCIDENT_DOCUMENT_TEMPLATE_CODE,
  getAccidentDocumentDefaultConfig,
} from "@/lib/accident-document";
import {
  AUDIT_PROTOCOL_TEMPLATE_CODE,
  getDefaultAuditProtocolConfig,
} from "@/lib/audit-protocol-document";
import {
  AUDIT_REPORT_TEMPLATE_CODE,
  getDefaultAuditReportConfig,
} from "@/lib/audit-report-document";
import {
  METAL_IMPURITY_TEMPLATE_CODE,
  getDefaultMetalImpurityConfig,
} from "@/lib/metal-impurity-document";
import { UV_LAMP_RUNTIME_TEMPLATE_CODE } from "@/lib/uv-lamp-runtime-document";
import { resolveJournalCodeAlias } from "@/lib/source-journal-map";
import {
  buildEquipmentCalibrationConfigFromEquipment,
  EQUIPMENT_CALIBRATION_TEMPLATE_CODE,
  normalizeEquipmentCalibrationConfig,
} from "@/lib/equipment-calibration-document";
import {
  CLEANING_VENTILATION_CHECKLIST_TEMPLATE_CODE,
  getDefaultCleaningVentilationConfig,
  normalizeCleaningVentilationConfig,
} from "@/lib/cleaning-ventilation-checklist-document";
import {
  defaultSdcConfig,
  isSanitaryDayChecklistTemplate,
} from "@/lib/sanitary-day-checklist-document";
import { isManagementRole, pickPrimaryManager } from "@/lib/user-roles";
import { aclActorFromSession, canWriteJournal, hasJournalAccess } from "@/lib/journal-acl";
import {
  normalizeJournalStaffBoundConfig,
  normalizeJournalDocumentStaffState,
} from "@/lib/journal-staff-binding";
import { NOT_AUTO_SEEDED } from "@/lib/journal-entry-filters";
import { prefillResponsiblesForNewDocument } from "@/lib/journal-responsibles-cascade";
import { seedEntriesForDocument } from "@/lib/journal-document-entries-seed";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const templateCode = searchParams.get("templateCode");
  const status = searchParams.get("status") || "active";

  if (!templateCode) {
    return NextResponse.json({ error: "templateCode обязателен" }, { status: 400 });
  }

  const resolvedTemplateCode = resolveJournalCodeAlias(templateCode);
  const template = await db.journalTemplate.findUnique({ where: { code: resolvedTemplateCode } });
  if (!template) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });

  // ACL: employees without an explicit grant for this template get 403.
  // Root/managers/unmigrated users bypass inside hasJournalAccess.
  const allowed = await hasJournalAccess(
    aclActorFromSession(session),
    resolvedTemplateCode
  );
  if (!allowed) {
    return NextResponse.json({ error: "Нет доступа к журналу" }, { status: 403 });
  }

  const documents = await db.journalDocument.findMany({
    where: {
      organizationId: getActiveOrgId(session),
      templateId: template.id,
      status,
      // Точки: документы активной точки и общие (без точки).
      ...buildingWhere(await getActiveBuildingId(session)),
    },
    orderBy: { dateFrom: "desc" },
    include: {
      // Считаем только реальные entries без _autoSeeded плейсхолдеров,
      // чтобы менеджер на /journals/[code] видел честный «N записей»
      // (5 реально заполненных, а не 35 включая seeded-болванки).
      _count: { select: { entries: { where: NOT_AUTO_SEEDED } } },
    },
  });

  return NextResponse.json({ documents, template });
}

/**
 * Подставляет «Дату ввода установки в эксплуатацию» (= дата начала
 * документа) в спецификацию УФ-установки, если она пустая. Ничего не
 * перетирает: заполненное значение и любые прочие ключи конфига
 * возвращаются как есть.
 */
function withUvCommissioningDate(
  config: Record<string, unknown> | undefined,
  dateFrom: string
): Record<string, unknown> | undefined {
  const dateKey = String(dateFrom).slice(0, 10);
  if (!dateKey) return config;
  const base = (config ?? {}) as Record<string, unknown>;
  const rawSpec = base.spec;
  const spec =
    rawSpec && typeof rawSpec === "object" && !Array.isArray(rawSpec)
      ? (rawSpec as Record<string, unknown>)
      : {};
  const current = typeof spec.commissioningDate === "string" ? spec.commissioningDate.trim() : "";
  if (current) return config;
  return { ...base, spec: { ...spec, commissioningDate: dateKey } };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  if (!isManagementRole(session.user.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = await request.json();
  const { templateCode, title, dateFrom, dateTo, responsibleUserId, responsibleTitle, config } = body;

  if (!templateCode || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "templateCode, dateFrom, dateTo обязательны" },
      { status: 400 }
    );
  }

  const resolvedTemplateCode = resolveJournalCodeAlias(templateCode);
  const template = await db.journalTemplate.findUnique({ where: { code: resolvedTemplateCode } });
  if (!template) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });

  const coldEquipmentConfig =
    resolvedTemplateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE
      ? buildColdEquipmentConfigFromEquipment(
          await db.equipment.findMany({
            where: {
              area: {
                organizationId: getActiveOrgId(session),
              },
            },
            select: {
              id: true,
              name: true,
              type: true,
              tempMin: true,
              tempMax: true,
            },
            orderBy: { name: "asc" },
          })
        )
      : undefined;

  const cleaningUsers =
    resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? await db.user.findMany({
          where: {
            organizationId: getActiveOrgId(session),
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            role: true,
            positionTitle: true,
          },
          orderBy: [{ role: "asc" }, { id: "asc" }],
        })
      : [];

  const allUsers = await db.user.findMany({
    where: {
      organizationId: getActiveOrgId(session),
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      role: true,
      positionTitle: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const allProducts =
    resolvedTemplateCode === FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE ||
    resolvedTemplateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE ||
    resolvedTemplateCode === GLASS_LIST_TEMPLATE_CODE ||
    resolvedTemplateCode === METAL_IMPURITY_TEMPLATE_CODE
      ? await db.product.findMany({
          where: {
            organizationId: getActiveOrgId(session),
            isActive: true,
          },
          select: {
            name: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  const metalSuppliers =
    resolvedTemplateCode === METAL_IMPURITY_TEMPLATE_CODE
      ? await db.batch.findMany({
          where: {
            organizationId: getActiveOrgId(session),
            supplier: { not: null },
          },
          select: {
            supplier: true,
          },
          orderBy: { supplier: "asc" },
          distinct: ["supplier"],
        })
      : [];

  const recentBatches =
    resolvedTemplateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE
      ? await db.batch.findMany({
          where: {
            organizationId: getActiveOrgId(session),
          },
          select: {
            code: true,
            productName: true,
            supplier: true,
            quantity: true,
            unit: true,
            receivedAt: true,
          },
          orderBy: { receivedAt: "desc" },
          take: 10,
        })
      : [];

  const allAreas =
    resolvedTemplateCode === GLASS_LIST_TEMPLATE_CODE
      ? await db.area.findMany({
          where: {
            organizationId: getActiveOrgId(session),
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  const allEquipment =
    resolvedTemplateCode === GLASS_LIST_TEMPLATE_CODE
      ? await db.equipment.findMany({
          where: {
            area: {
              organizationId: getActiveOrgId(session),
            },
          },
          select: {
            name: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  const cleaningAreas =
    resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? await db.area.findMany({
          where: {
            organizationId: getActiveOrgId(session),
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  // Точки: новый документ принадлежит активной точке, помещения — её же.
  const activeBuildingId = await getActiveBuildingId(session);

  // 2026-09-04: единый справочник помещений. Климат и график ген. уборок
  // сидируются из Room (/settings/buildings), а не из legacy Area.
  const directoryRooms =
    resolvedTemplateCode === CLIMATE_DOCUMENT_TEMPLATE_CODE ||
    resolvedTemplateCode === SANITATION_DAY_TEMPLATE_CODE
      ? await db.room.findMany({
          where: {
            building: {
              organizationId: getActiveOrgId(session),
              ...(activeBuildingId ? { id: activeBuildingId } : {}),
            },
          },
          select: { id: true, name: true, climateNorms: true },
          orderBy: [{ buildingId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        })
      : [];

  // C1/C2 аудита: помещения уборки — это таблица Room
  // (/settings/buildings), а не blueprint'ы в config.rooms. Матрицу и
  // план строим по ним; расписание Т/Г тоже приходит отсюда.
  const cleaningRooms =
    resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? await db.room.findMany({
          where: {
            building: {
              organizationId: getActiveOrgId(session),
              ...(activeBuildingId ? { id: activeBuildingId } : {}),
            },
          },
          select: {
            id: true,
            currentDays: true,
            generalDays: true,
            currentScheduleType: true,
            generalScheduleType: true,
            currentMonthDays: true,
            generalMonthDays: true,
          },
          orderBy: [{ buildingId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        })
      : [];
  const cleaningRoomIds = cleaningRooms.map((room) => room.id);
  const cleaningRoomSchedule =
    cleaningRooms.length > 0 ? toRoomScheduleMap(cleaningRooms) : undefined;

  const cleaningDefaults =
    resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? getDefaultCleaningResponsibleIds(cleaningUsers)
      : null;

  // Org-level шаблон по умолчанию для cleaning. Когда менеджер
  // нажимает «Сохранить как шаблон» — config записывается в
  // Organization.defaultCleaningDocumentConfig. Здесь вытаскиваем,
  // чтобы новые JournalDocument создавались с теми же rooms/scopes/days.
  const cleaningOrgDefault =
    resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? await db.organization
          .findUnique({
            where: { id: getActiveOrgId(session) },
            select: { defaultCleaningDocumentConfig: true },
          })
          .then((row) => {
            const raw = row?.defaultCleaningDocumentConfig;
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
            return raw as Record<string, unknown>;
          })
      : null;

  // Самый последний предыдущий JournalDocument для cleaning в этой орге.
  // Используется чтобы новый журнал создавался «как прошлый» — теми же
  // rooms, ответственными, weekday-масками. matrix/marks (период-специфика)
  // отрезаем — в новом периоде свои даты, отметки уборщицы не переносятся.
  const cleaningPrevDocRaw =
    resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? await db.journalDocument.findFirst({
          where: {
            organizationId: getActiveOrgId(session),
            template: { code: CLEANING_DOCUMENT_TEMPLATE_CODE },
          },
          orderBy: [{ dateFrom: "desc" }, { createdAt: "desc" }],
          select: { id: true, dateFrom: true, config: true },
        })
      : null;
  const cleaningPrevDocConfig = stripPeriodSpecificCleaningFields(
    cleaningPrevDocRaw?.config,
  );

  const equipmentCalibrationSource =
    resolvedTemplateCode === EQUIPMENT_CALIBRATION_TEMPLATE_CODE
      ? await db.equipment.findMany({
          where: {
            area: {
              organizationId: getActiveOrgId(session),
            },
          },
          select: {
            id: true,
            name: true,
            type: true,
            serialNumber: true,
            tempMin: true,
            tempMax: true,
            area: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [{ area: { name: "asc" } }, { name: "asc" }],
        })
      : [];

  const rawConfig =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>)
      : undefined;


  const calibrationYear = Number(String(dateFrom).slice(0, 4)) || new Date().getUTCFullYear();
  const calibrationOwner = pickPrimaryManager(allUsers);
  const calibrationProvidedRows =
    rawConfig && Array.isArray(rawConfig.rows) && rawConfig.rows.length > 0
      ? normalizeEquipmentCalibrationConfig(rawConfig).rows
      : null;
  const equipmentCalibrationConfig =
    resolvedTemplateCode === EQUIPMENT_CALIBRATION_TEMPLATE_CODE
      ? (() => {
          const built = buildEquipmentCalibrationConfigFromEquipment(
            equipmentCalibrationSource,
            {
              ...rawConfig,
              year: calibrationYear,
            }
          );

          return {
            ...built,
            year: calibrationYear,
            approveEmployee: built.approveEmployee || calibrationOwner?.name || "",
            rows: calibrationProvidedRows || built.rows,
          };
        })()
      : undefined;

  const initialConfig =
    resolvedTemplateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE
      ? coldEquipmentConfig
      : resolvedTemplateCode === EQUIPMENT_CALIBRATION_TEMPLATE_CODE
      ? equipmentCalibrationConfig
      : resolvedTemplateCode === CLIMATE_DOCUMENT_TEMPLATE_CODE
      ? buildClimateConfigFromRooms(directoryRooms)
      : resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? // «Как прошлый журнал»: если есть предыдущий документ —
        // используем его rooms/schedule/планы как структурную основу,
        // НО даём body перебить responsibles/title/settings (это явный
        // выбор менеджера в диалоге создания).
        //
        // Раньше cleaning-documents-client всегда отправлял body.config
        // построенный из defaultCleaningDocumentConfig (с пустыми
        // blueprint-rooms), и server.rawConfig полностью перекрывал
        // prev-doc fallback. Из-за этого новый документ создавался с
        // дефолтными комнатами (currentDays=127, generalDays=0) и
        // applyRoomScheduleToMatrix размечал все ячейки T.
        //
        // Теперь даже когда rawConfig пришёл — prev doc'а rooms +
        // structural fields имеют приоритет; перезаписываем только
        // явные body-fields (responsibles + title + settings + autoFill).
        normalizeCleaningDocumentConfig(
          (() => {
            if (!cleaningPrevDocConfig) {
              return (
                rawConfig
                ?? cleaningOrgDefault
                ?? defaultCleaningDocumentConfig(cleaningUsers, cleaningAreas)
              );
            }
            if (!rawConfig) return cleaningPrevDocConfig;
            const body = rawConfig;
            // BASE = prev. Matrix/marks ОСТАЁМ — будем remap'ить по
            // day-of-week в новый период через copyMatrixByWeekday
            // (см. ниже applyRoomScheduleToMatrix call). Это сохраняет
            // pattern уборки прошлого периода («каждая среда = G,
            // выходные = /»), а не теряет его.
            const merged: Record<string, unknown> = { ...cleaningPrevDocConfig };
            // Body-fields, которые перебивают prev (явный выбор менеджера):
            if (Array.isArray(body.cleaningResponsibles)) {
              merged.cleaningResponsibles = body.cleaningResponsibles;
            }
            if (Array.isArray(body.controlResponsibles)) {
              merged.controlResponsibles = body.controlResponsibles;
            }
            if (typeof body.title === "string" && body.title) {
              merged.title = body.title;
            }
            if (typeof body.documentTitle === "string" && body.documentTitle) {
              merged.documentTitle = body.documentTitle;
            }
            if (body.autoFill && typeof body.autoFill === "object") {
              merged.autoFill = body.autoFill;
            }
            if (body.settings && typeof body.settings === "object") {
              merged.settings = body.settings;
            }
            return merged;
          })(),
          {
            users: cleaningUsers,
            areas: cleaningAreas,
          },
        )
      : resolvedTemplateCode === CLEANING_VENTILATION_CHECKLIST_TEMPLATE_CODE
      ? normalizeCleaningVentilationConfig(
          rawConfig ?? getDefaultCleaningVentilationConfig(allUsers),
          allUsers
        )
      : resolvedTemplateCode === FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE
      ? buildFinishedProductConfigFromUsers(
          allUsers,
          allProducts.map((product) => product.name)
        )
      : resolvedTemplateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE
      ? buildProductWriteoffConfigFromData({
          users: allUsers,
          products: allProducts,
          batches: recentBatches,
          referenceDate: new Date(dateFrom),
        })
      : resolvedTemplateCode === GLASS_LIST_TEMPLATE_CODE
      ? buildGlassListConfigFromData({
          users: allUsers,
          areas: allAreas,
          equipment: allEquipment,
          products: allProducts,
          referenceDate: new Date(dateFrom),
        })
      : isAcceptanceDocumentTemplate(resolvedTemplateCode)
      ? getAcceptanceDocumentDefaultConfig(allUsers)
      : resolvedTemplateCode === PPE_ISSUANCE_TEMPLATE_CODE
      ? getPpeIssuanceDefaultConfig(allUsers)
      : resolvedTemplateCode === SANITATION_DAY_TEMPLATE_CODE
      ? // «График и учет генеральных уборок» — годовой бланк. Строки
        // берём из помещений организации (раньше подставлялись
        // демо-строки дефолта), а должность/ФИО ответственного из
        // диалога создания кладём в блок «УТВЕРЖДАЮ» (`approve*`).
        // rows из body уважаем только если они непустые: диалог
        // присылает лишь approve*/responsible*, и наивный merge обнулил
        // бы список помещений.
        (() => {
          const base = buildSanitationDayConfigFromRooms(directoryRooms, new Date(dateFrom));
          const provided = (rawConfig || {}) as Record<string, unknown>;
          const providedRows =
            Array.isArray(provided.rows) && provided.rows.length > 0;
          return {
            ...base,
            ...provided,
            rows: providedRows ? provided.rows : base.rows,
          };
        })()
      : resolvedTemplateCode === TRAINING_PLAN_TEMPLATE_CODE
      ? getTrainingPlanDefaultConfig()
      : resolvedTemplateCode === BREAKDOWN_HISTORY_TEMPLATE_CODE
      ? getBreakdownHistoryDefaultConfig()
      : resolvedTemplateCode === ACCIDENT_DOCUMENT_TEMPLATE_CODE
      ? getAccidentDocumentDefaultConfig()
      : resolvedTemplateCode === AUDIT_PROTOCOL_TEMPLATE_CODE
      ? getDefaultAuditProtocolConfig()
      : resolvedTemplateCode === AUDIT_REPORT_TEMPLATE_CODE
      ? getDefaultAuditReportConfig()
      : resolvedTemplateCode === METAL_IMPURITY_TEMPLATE_CODE
      ? getDefaultMetalImpurityConfig({
          users: allUsers,
          materials: allProducts.map((item) => item.name).filter(Boolean),
          suppliers: metalSuppliers
            .map((item) => item.supplier || "")
            .filter(Boolean),
          date: typeof dateFrom === "string" ? dateFrom : new Date(dateFrom).toISOString().slice(0, 10),
          responsibleName:
            rawConfig && typeof rawConfig.responsibleEmployee === "string"
              ? rawConfig.responsibleEmployee
              : undefined,
          responsiblePosition:
            rawConfig && typeof rawConfig.responsiblePosition === "string"
              ? rawConfig.responsiblePosition
              : undefined,
        })
      : isSanitaryDayChecklistTemplate(resolvedTemplateCode)
      ? rawConfig ?? defaultSdcConfig()
      : isRegisterDocumentTemplate(resolvedTemplateCode)
      ? buildRegisterDocumentConfigFromUsers(allUsers)
      : undefined;

  const cleaningControlRole =
    resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? cleaningUsers.find(
          (user) =>
            user.id ===
            (responsibleUserId ||
              (initialConfig as { controlResponsibles?: Array<{ userId?: string }> } | undefined)
                ?.controlResponsibles?.[0]?.userId ||
              cleaningDefaults?.responsibleControlUserId)
        )?.role || null
      : null;

  const fallbackResponsibleUserId =
    (resolvedTemplateCode === GLASS_LIST_TEMPLATE_CODE
      ? ((initialConfig as { responsibleUserId?: string } | undefined)?.responsibleUserId || null)
      : null) ||
    (resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? ((initialConfig as { controlResponsibles?: Array<{ userId?: string }> } | undefined)
          ?.controlResponsibles?.[0]?.userId ||
        cleaningDefaults?.responsibleControlUserId ||
        null)
      : null);
  const fallbackResponsibleTitle =
    responsibleTitle ||
    (resolvedTemplateCode === GLASS_LIST_TEMPLATE_CODE
      ? ((initialConfig as { responsibleTitle?: string } | undefined)?.responsibleTitle || null)
      : null) ||
    (resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? ((initialConfig as { controlResponsibles?: Array<{ title?: string }> } | undefined)
          ?.controlResponsibles?.[0]?.title ||
        getHygienePositionLabel(cleaningControlRole || "owner"))
      : null);
  const configForDocument =
    resolvedTemplateCode === EQUIPMENT_CALIBRATION_TEMPLATE_CODE
      ? equipmentCalibrationConfig
      : resolvedTemplateCode === CLEANING_DOCUMENT_TEMPLATE_CODE
      ? // Cleaning: используем уже-merged initialConfig (содержит prev doc
        // как базу + body responsibles/title), НЕ rawConfig напрямую.
        // Раньше тут было `rawConfig ?? initialConfig` и rawConfig из
        // body всегда побеждал → merge logic выше игнорировался полностью.
        //
        // Шаги:
        //   1. Нормализуем merged config.
        //   2. Если был prev doc — копируем его matrix в новый period
        //      по day-of-week pattern'у (среда → среда, выходные → выходные).
        //      Это сохраняет фактический ритм уборки прошлого месяца.
        //   3. Если prev'а не было — fill-empty по weekday-маскам комнат.
        (() => {
          const normalized = normalizeCleaningDocumentConfig(
            applyRoomsToCleaningConfig(initialConfig, cleaningRoomIds),
            {
              users: cleaningUsers,
              areas: cleaningAreas,
            },
          );
          const newDateKeys = buildDateKeys(dateFrom, dateTo);
          if (cleaningPrevDocConfig) {
            const prevMatrix =
              (cleaningPrevDocConfig as { matrix?: CleaningMatrixMap }).matrix;
            let remapped = copyMatrixByWeekday(prevMatrix, newDateKeys);
            // Поверх копии — оверрайдим выходные и праздники РФ-календаря
            // на «/». Прошлый период мог иметь T на Sat (если уборщица
            // там работала или менеджер случайно отметил), но в новом
            // периоде дни недели сместились + могут быть праздники, и
            // поведение по умолчанию должно быть «не убиралась». Pattern
            // T-на-будни / G-по-средам сохраняется через copy, а
            // weekends/holidays зануляем «/» как в кнопке «План заново».
            remapped = applyWeekendHolidayMark(remapped, newDateKeys, normalized);
            return {
              ...normalized,
              matrix: remapped,
              marks: remapped,
            };
          }
          return applyRoomScheduleToMatrix(
            normalized,
            newDateKeys,
            "fill-empty",
            cleaningRoomSchedule,
          );
        })()
      : resolvedTemplateCode === CLEANING_VENTILATION_CHECKLIST_TEMPLATE_CODE
      ? normalizeCleaningVentilationConfig(rawConfig ?? initialConfig, allUsers)
      : resolvedTemplateCode === PRODUCT_WRITEOFF_TEMPLATE_CODE
      ? normalizeJournalStaffBoundConfig(
          resolvedTemplateCode,
          {
            ...(((initialConfig as Record<string, unknown>) || {}) as Record<string, unknown>),
            ...((rawConfig || {}) as Record<string, unknown>),
          },
          allUsers
        )
      : resolvedTemplateCode === GLASS_LIST_TEMPLATE_CODE
      ? {
          ...(((initialConfig as Record<string, unknown>) || {}) as Record<string, unknown>),
          ...((rawConfig || {}) as Record<string, unknown>),
        }
      : normalizeJournalStaffBoundConfig(
          resolvedTemplateCode,
          config ?? initialConfig ?? undefined,
          allUsers
        );
  const normalizedDocumentState = normalizeJournalDocumentStaffState(
    resolvedTemplateCode,
    {
      config: configForDocument,
      responsibleUserId: responsibleUserId || fallbackResponsibleUserId,
      responsibleTitle: fallbackResponsibleTitle,
    },
    allUsers
  );

  // Prefill from /settings/journal-responsibles (Organization
  // .journalResponsibleUsersJson). Это закрывает gap'ы:
  //   • Если пользователь НЕ передал responsibleUserId/Title в body —
  //     подставляем из глобальных настроек ответственных журнала.
  //   • Phase C verifier (verifierUserId) — у нас раньше всегда был
  //     null при manual create. Теперь читается из глобальных слотов.
  //   • Per-journal config patcher (cleaningResponsibles[],
  //     approveEmployeeId и т.д.) — патчит config теми же глобальными
  //     юзерами, чтобы документ был полностью pre-filled.
  // Body values имеют приоритет: если manager явно выбрал юзера в
  // диалоге создания — его выбор сохраняется.
  const prefilled = await prefillResponsiblesForNewDocument({
    organizationId: getActiveOrgId(session),
    journalCode: resolvedTemplateCode,
    baseConfig:
      (normalizedDocumentState.config as Record<string, unknown> | undefined) ??
      undefined,
  });

  // Slots из /settings/journal-responsibles — приоритет над body.
  // Раньше body.responsibleUserId побеждал prefilled, и настройки
  // ответственных каждый раз переопределялись авто-выбором первого
  // подходящего юзера в диалоге создания. Теперь settings-slot'ы
  // имеют приоритет; если их нет — fallback на body.
  const finalResponsibleUserId =
    prefilled.responsibleUserId || normalizedDocumentState.responsibleUserId;
  // Если responsibleUserId пришёл из prefilled (из настроек journal-
  // responsibles), берём ТИТУЛ из job position юзера, а не из
  // fallback-логики (которая для cleaning возвращала «Управляющий»,
  // для других тоже невпопад). Body title уважается только если
  // пользователь явно его передал и prefilled не выставил юзера.
  let finalResponsibleTitle = normalizedDocumentState.responsibleTitle ?? null;
  if (
    prefilled.responsibleUserId &&
    finalResponsibleUserId === prefilled.responsibleUserId
  ) {
    const primaryUserPos = await db.user.findUnique({
      where: { id: prefilled.responsibleUserId },
      select: { jobPosition: { select: { name: true } }, positionTitle: true },
    });
    const positionName =
      primaryUserPos?.jobPosition?.name || primaryUserPos?.positionTitle || null;
    if (positionName) {
      finalResponsibleTitle = positionName;
    }
  }
  // ВСЕГДА используем prefilled.config — patcher уже сделал merge:
  // body fields сохранил, slot-user'ов из настроек проставил поверх.
  // Раньше при наличии rawConfig мы оставляли normalizedDocumentState.config
  // (PRE-патчер), и слот-пользователи терялись.
  const baseFinalConfig =
    prefilled.config ??
    (normalizedDocumentState.config as Record<string, unknown> | undefined);

  // «Периодичность контроля» приходит отдельным top-level полем, а не внутри
  // `config`: per-journal нормализаторы собирают свежий объект и выкинули бы
  // незнакомый ключ. Пустая строка — валидное значение (владелец убрал строку
  // из бумажной шапки), поэтому проверяем именно `!== undefined`.
  const finalConfig =
    body.controlPeriodicity !== undefined
      ? {
          ...(baseFinalConfig ?? {}),
          [CONTROL_PERIODICITY_CONFIG_KEY]: sanitizeControlPeriodicity(
            body.controlPeriodicity
          ),
        }
      : baseFinalConfig;

  /**
   * P8: «Дата ввода установки в эксплуатацию» у бактерицидной установки
   * по умолчанию равна дате начала документа.
   *
   * Раньше дефолт жил ТОЛЬКО в диалоге редактирования спецификации
   * (`uv-lamp-runtime-document-client.tsx`, `defaultCommissioningDate`) —
   * то есть в конфиг он попадал лишь после того, как кто-то откроет и
   * сохранит настройки. Документы, созданные из списка/cron'ом, ехали с
   * пустой датой, и в бумажной спецификации стоял прочерк. Ставим её
   * ЗДЕСЬ, в единственной серверной точке создания, и только если поле
   * действительно пустое — явный выбор пользователя не перетираем.
   */
  const finalConfigWithUvDefaults =
    resolvedTemplateCode === UV_LAMP_RUNTIME_TEMPLATE_CODE
      ? withUvCommissioningDate(finalConfig, dateFrom)
      : finalConfig;

  const doc = await db.journalDocument.create({
    data: {
      templateId: template.id,
      organizationId: getActiveOrgId(session),
      buildingId: activeBuildingId,
      // Пустое название → «Имя журнала — период» (как в диалогах создания),
      // а не голое имя шаблона: список документов иначе состоял из клонов.
      title:
        (typeof title === "string" && title.trim()) ||
        buildDocumentAutoTitle({
          templateCode: resolvedTemplateCode,
          journalName: template.name,
          dateFrom: String(dateFrom),
          dateTo: String(dateTo),
          year: (config as { year?: string | number } | undefined)?.year,
        }),
      config: finalConfigWithUvDefaults as Prisma.InputJsonValue | undefined,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      responsibleUserId: finalResponsibleUserId,
      responsibleTitle: finalResponsibleTitle,
      verifierUserId: prefilled.verifierUserId,
      createdById: session.user.id,
    },
  });

  // Сид строк — как в cron-пути (ensureActiveDocument). Без него
  // созданный вручную гигиенический документ открывался пустым
  // («Записей нет»), тогда как на эталоне сразу видны строки
  // сотрудников. Логика PER_DAY / PER_EMPLOYEE_PER_DAY внутри
  // seedEntriesForDocument; для остальных журналов — no-op.
  await seedEntriesForDocument({
    documentId: doc.id,
    journalCode: resolvedTemplateCode,
    organizationId: getActiveOrgId(session),
    dateFrom: doc.dateFrom,
    dateTo: doc.dateTo,
    responsibleUserId: finalResponsibleUserId ?? null,
  }).catch((err) => {
    console.warn(
      `[journal-documents] seedEntries failed for ${resolvedTemplateCode}`,
      err
    );
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
