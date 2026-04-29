import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { generatePoolForDay, type TaskScope } from "@/lib/journal-task-pool";
import {
  getActiveClaimForUser,
  listClaimsForJournal,
} from "@/lib/journal-task-claims";
import { parseDisabledCodes } from "@/lib/disabled-journals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mini/today — единый список ВСЕХ доступных сотруднику задач
 * на сегодня по всем pool-журналам организации.
 *
 * Объединяет pool generator'ы из journal-task-pool по всем enabled
 * журналам. Возвращает плоский список с группировкой по journalCode.
 */

const POOL_CODES = [
  "hygiene",
  "health_check",
  "cold_equipment_control",
  "climate_control",
  "cleaning",
  "incoming_control",
  "finished_product",
  "disinfectant_usage",
  "fryer_oil",
  "accident_journal",
  "complaint_register",
  "breakdown_history",
  "ppe_issuance",
  "glass_items_list",
  "glass_control",
  "metal_impurity",
  "perishable_rejection",
  "product_writeoff",
  "traceability_test",
  "general_cleaning",
  "sanitation_day_control",
  "sanitary_day_control",
  "pest_control",
  "intensive_cooling",
  "uv_lamp_runtime",
  "equipment_maintenance",
  "equipment_calibration",
  "equipment_cleaning",
  "audit_plan",
  "audit_protocol",
  "audit_report",
  "training_plan",
];

const JOURNAL_LABELS: Record<string, string> = {
  hygiene: "Гигиена",
  health_check: "Проверка здоровья",
  cold_equipment_control: "Холодильники",
  climate_control: "Климат",
  cleaning: "Уборка",
  incoming_control: "Приёмка",
  finished_product: "Бракераж",
  disinfectant_usage: "Дезсредства",
  fryer_oil: "Фритюр",
  accident_journal: "Аварии",
  complaint_register: "Жалобы",
  breakdown_history: "Поломки",
  ppe_issuance: "СИЗ",
  glass_items_list: "Стекло (список)",
  glass_control: "Контроль стекла",
  metal_impurity: "Металлопримеси",
  perishable_rejection: "Скоропорт",
  product_writeoff: "Списание",
  traceability_test: "Прослеживаемость",
  general_cleaning: "Генуборка",
  sanitation_day_control: "Сан. день",
  sanitary_day_control: "Сан. день",
  pest_control: "Дератизация",
  intensive_cooling: "Интенс. охл.",
  uv_lamp_runtime: "УФ-лампа",
  equipment_maintenance: "Тех. обслуж.",
  equipment_calibration: "Поверка",
  equipment_cleaning: "Чистка обор.",
  audit_plan: "План аудита",
  audit_protocol: "Протокол аудита",
  audit_report: "Отчёт аудита",
  training_plan: "План обучения",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const organizationId = getActiveOrgId(session);
  const userId = session.user.id;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { disabledJournalCodes: true },
  });
  const disabled = parseDisabledCodes(org?.disabledJournalCodes);

  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10);

  const myActive = await getActiveClaimForUser(userId, organizationId);

  type EnrichedScope = TaskScope & {
    journalCode: string;
    journalLabel: string;
    availability: "available" | "mine" | "taken" | "completed";
    claimUserName?: string | null;
    claimId?: string;
  };

  const groups: { code: string; label: string; scopes: EnrichedScope[] }[] = [];

  for (const code of POOL_CODES) {
    if (disabled.has(code)) continue;
    const [pool, claims] = await Promise.all([
      generatePoolForDay({ organizationId, journalCode: code, date: today }),
      listClaimsForJournal({
        organizationId,
        journalCode: code,
        dateKey: today,
      }),
    ]);
    if (!pool.pool || pool.scopes.length === 0) continue;
    const claimByScope = new Map<
      string,
      { active?: typeof claims[number]; completed?: typeof claims[number] }
    >();
    for (const c of claims) {
      const b = claimByScope.get(c.scopeKey) ?? {};
      if (c.status === "active") b.active = c;
      if (c.status === "completed") b.completed = c;
      claimByScope.set(c.scopeKey, b);
    }
    const enriched: EnrichedScope[] = pool.scopes.map((s) => {
      const b = claimByScope.get(s.scopeKey) ?? {};
      let availability: EnrichedScope["availability"] = "available";
      let claimUserName: string | null | undefined;
      let claimId: string | undefined;
      if (b.completed) {
        availability = "completed";
        claimUserName = b.completed.userName;
        claimId = b.completed.id;
      } else if (b.active) {
        availability = b.active.userId === userId ? "mine" : "taken";
        claimUserName = b.active.userName;
        claimId = b.active.id;
      }
      return {
        ...s,
        journalCode: code,
        journalLabel: JOURNAL_LABELS[code] ?? code,
        availability,
        claimUserName,
        claimId,
      };
    });
    groups.push({
      code,
      label: JOURNAL_LABELS[code] ?? code,
      scopes: enriched,
    });
  }

  return NextResponse.json({
    dateKey,
    groups,
    myActive: myActive
      ? {
          id: myActive.id,
          journalCode: myActive.journalCode,
          scopeKey: myActive.scopeKey,
          scopeLabel: myActive.scopeLabel,
        }
      : null,
  });
}
