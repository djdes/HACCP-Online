import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import { toDateKey } from "@/lib/hygiene-document";
import {
  applyStaffJournalAutoFill,
  HEALTH_CHECK_TEMPLATE_CODE,
  HYGIENE_TEMPLATE_CODE,
} from "@/lib/staff-journal-autofill";
import {
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  buildClimateAutoFillEntryData,
  buildClimateAutoFillRows,
  mergeClimateEntryData,
  normalizeClimateDocumentConfig,
  normalizeClimateEntryData,
  syncClimateEntryDataWithConfig,
} from "@/lib/climate-document";
import {
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
  buildColdEquipmentAutoFillEntryData,
  buildColdEquipmentAutoFillRows,
  mergeColdEquipmentEntryData,
  normalizeColdEquipmentDocumentConfig,
  normalizeColdEquipmentEntryData,
  syncColdEquipmentEntryDataWithConfig,
} from "@/lib/cold-equipment-document";
import { UV_LAMP_RUNTIME_TEMPLATE_CODE, normalizeUvRuntimeDocumentConfig } from "@/lib/uv-lamp-runtime-document";
import { applyUvRuntimeAutoFill } from "@/lib/uv-lamp-runtime-autofill";
import { pickPrimaryManager } from "@/lib/user-roles";
import { listAutomationOwnedCodes } from "@/lib/journal-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/auto-fill-journals?secret=$CRON_SECRET
 *
 * Ежедневное автозаполнение журналов, у которых включён тумблер
 * «Автоматически заполнять журнал» (`JournalDocument.autoFill = true`).
 *
 * Правило эталона (haccp-online): тумблер работает ЕЖЕДНЕВНО, а не
 * однократно в момент включения. Cron дозаполняет ТОЛЬКО сегодняшний
 * день и ТОЛЬКО пустые значения — ручные записи не перетираются.
 *
 * Поддерживаемые журналы:
 *   - hygiene / health_check — через `applyStaffJournalAutoFill`
 *     (тот же helper, что и action `apply_auto_fill` в
 *     /api/journal-documents/[id]/staff). Графики выходных/отпусков/
 *     больничных применяются ТОЛЬКО к гигиеническому журналу.
 *   - climate_control — `buildClimateAutoFillRows` (учитывает skipWeekends).
 *   - cold_equipment_control — `buildColdEquipmentAutoFillRows`.
 *   - uv_lamp_runtime — типовой сеанс из спецификации установки.
 * Остальные журналы cron не трогает.
 *
 * Идемпотентно: повторный прогон в тот же день не делает изменений.
 *
 * INFRA NEXT: внешний cron 05:00 MSK ежедневно (после
 * /api/cron/auto-create-journals в 04:00 — чтобы документ на сегодня
 * уже существовал).
 */
const SUPPORTED_CODES = [
  HYGIENE_TEMPLATE_CODE,
  HEALTH_CHECK_TEMPLATE_CODE,
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
  UV_LAMP_RUNTIME_TEMPLATE_CODE,
];

type OrgUser = { id: string; role: string };

async function handle(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;

  const todayKey = toDateKey(new Date());
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

  const documents = await db.journalDocument.findMany({
    where: {
      status: "active",
      autoFill: true,
      dateFrom: { lte: todayDate },
      dateTo: { gte: todayDate },
      template: { code: { in: SUPPORTED_CODES } },
    },
    include: {
      template: { select: { code: true } },
      entries: { where: { date: todayDate } },
    },
  });

  // Журналы, которые целиком ведёт cron автоматизации 06:00, здесь
  // пропускаем — иначе одну и ту же работу делают два разных cron'а и
  // в логах невозможно понять, кто что заполнил.
  const automationByOrg = new Map<string, Set<string>>();
  async function getAutomationOwned(organizationId: string): Promise<Set<string>> {
    const cached = automationByOrg.get(organizationId);
    if (cached) return cached;
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { journalAutomationJson: true, autoJournalCodes: true },
    });
    const owned = new Set(listAutomationOwnedCodes(org));
    automationByOrg.set(organizationId, owned);
    return owned;
  }

  const usersByOrg = new Map<string, OrgUser[]>();
  async function getUsers(organizationId: string): Promise<OrgUser[]> {
    const cached = usersByOrg.get(organizationId);
    if (cached) return cached;
    const users = await db.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, role: true },
      orderBy: [{ role: "asc" }, { id: "asc" }],
    });
    usersByOrg.set(organizationId, users);
    return users;
  }

  let created = 0;
  let updated = 0;
  let documentsTouched = 0;
  const byTemplate: Record<string, number> = {};
  const errors: string[] = [];

  for (const document of documents) {
    const code = document.template.code;
    try {
      const owned = await getAutomationOwned(document.organizationId);
      if (owned.has(code)) continue;
      const users = await getUsers(document.organizationId);
      let result = { created: 0, updated: 0 };

      if (code === HYGIENE_TEMPLATE_CODE || code === HEALTH_CHECK_TEMPLATE_CODE) {
        if (users.length === 0) continue;
        result = await applyStaffJournalAutoFill(db, {
          documentId: document.id,
          templateCode: code,
          employeeIds: users.map((user) => user.id),
          dateKeys: [todayKey],
          entries: document.entries,
        });
      } else if (code === CLIMATE_DOCUMENT_TEMPLATE_CODE) {
        result = await fillClimateToday(document, users, todayKey);
      } else if (code === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE) {
        result = await fillColdEquipmentToday(document, users, todayKey);
      } else if (code === UV_LAMP_RUNTIME_TEMPLATE_CODE) {
        const responsibleUserId =
          document.responsibleUserId || pickPrimaryManager(users)?.id;
        if (!responsibleUserId) continue;
        result = await applyUvRuntimeAutoFill(db, {
          documentId: document.id,
          spec: normalizeUvRuntimeDocumentConfig(document.config).spec,
          responsibleUserId,
          dateKeys: [todayKey],
          entries: document.entries,
        });
      }

      created += result.created;
      updated += result.updated;
      if (result.created > 0 || result.updated > 0) {
        documentsTouched += 1;
        byTemplate[code] = (byTemplate[code] ?? 0) + result.created + result.updated;
      }
    } catch (err) {
      errors.push(
        `document=${document.id} code=${code}: ${(err as Error).message ?? "ошибка"}`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    date: todayKey,
    documentsScanned: documents.length,
    documentsTouched,
    entriesCreated: created,
    entriesUpdated: updated,
    byTemplate,
    errors: errors.slice(0, 10),
  });
}

type DocumentWithEntries = {
  id: string;
  config: unknown;
  responsibleUserId: string | null;
  responsibleTitle: string | null;
  entries: { id: string; employeeId: string; date: Date; data: unknown }[];
};

/** Климат: одна строка на (ответственный, дата), значения по min/max комнат. */
async function fillClimateToday(
  document: DocumentWithEntries,
  users: OrgUser[],
  todayKey: string
): Promise<{ created: number; updated: number }> {
  const responsibleUserId =
    document.responsibleUserId || pickPrimaryManager(users)?.id;
  if (!responsibleUserId) return { created: 0, updated: 0 };

  const config = normalizeClimateDocumentConfig(document.config);
  const rows = buildClimateAutoFillRows({
    config,
    dateFrom: todayKey,
    dateTo: todayKey,
    responsibleTitle: document.responsibleTitle,
    responsibleUserId,
  });
  // skipWeekends мог отфильтровать сегодняшний день.
  if (rows.length === 0) return { created: 0, updated: 0 };

  const existingByKey = new Map(
    document.entries.map((entry) => [
      `${entry.employeeId}:${toDateKey(entry.date)}`,
      entry,
    ])
  );

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const key = `${row.employeeId}:${toDateKey(row.date)}`;
    const existing = existingByKey.get(key);

    if (!existing) {
      const result = await db.journalDocumentEntry.createMany({
        data: [
          {
            documentId: document.id,
            employeeId: row.employeeId,
            date: row.date,
            data: row.data,
          },
        ],
        skipDuplicates: true,
      });
      created += result.count;
      continue;
    }

    const current = syncClimateEntryDataWithConfig(
      normalizeClimateEntryData(existing.data),
      config
    );
    const merged = mergeClimateEntryData(
      current,
      buildClimateAutoFillEntryData({
        config,
        dateKey: toDateKey(row.date),
        responsibleTitle: document.responsibleTitle,
      })
    );

    // Идемпотентность: пишем только если что-то реально поменялось.
    if (JSON.stringify(merged) === JSON.stringify(normalizeClimateEntryData(existing.data))) {
      continue;
    }

    await db.journalDocumentEntry.update({
      where: { id: existing.id },
      data: { data: merged },
    });
    updated += 1;
  }

  return { created, updated };
}

/** Холодильное оборудование: одна строка на дату. */
async function fillColdEquipmentToday(
  document: DocumentWithEntries,
  users: OrgUser[],
  todayKey: string
): Promise<{ created: number; updated: number }> {
  const responsibleUserId =
    document.responsibleUserId || pickPrimaryManager(users)?.id;
  if (!responsibleUserId) return { created: 0, updated: 0 };

  const config = normalizeColdEquipmentDocumentConfig(document.config);
  const rows = buildColdEquipmentAutoFillRows({
    config,
    dateFrom: todayKey,
    dateTo: todayKey,
    responsibleTitle: document.responsibleTitle,
    responsibleUserId,
  });
  if (rows.length === 0) return { created: 0, updated: 0 };

  const existing = document.entries.find(
    (entry) => toDateKey(entry.date) === todayKey
  );
  const row = rows[0];

  if (!existing) {
    const result = await db.journalDocumentEntry.createMany({
      data: [
        {
          documentId: document.id,
          employeeId: row.employeeId,
          date: row.date,
          data: row.data,
        },
      ],
      skipDuplicates: true,
    });
    return { created: result.count, updated: 0 };
  }

  const current = syncColdEquipmentEntryDataWithConfig(
    normalizeColdEquipmentEntryData(existing.data),
    config
  );
  const merged = mergeColdEquipmentEntryData(
    current,
    buildColdEquipmentAutoFillEntryData({
      config,
      dateKey: todayKey,
      responsibleTitle: document.responsibleTitle,
    })
  );

  if (
    JSON.stringify(merged) ===
    JSON.stringify(normalizeColdEquipmentEntryData(existing.data))
  ) {
    return { created: 0, updated: 0 };
  }

  await db.journalDocumentEntry.update({
    where: { id: existing.id },
    data: { data: merged },
  });

  return { created: 0, updated: 1 };
}

export const GET = handle;
export const POST = handle;
