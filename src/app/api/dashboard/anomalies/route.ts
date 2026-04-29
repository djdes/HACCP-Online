import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/anomalies
 *
 * Сканирует JournalDocumentEntry за последние 14 дней по организации
 * и возвращает «подозрительные» записи — те, что часто означают халтуру
 * или ошибку ввода:
 *
 *   1. **temperature_out_of_range** — поле data.temperature (или
 *      data.temp / data.tempC) выходит за допустимый диапазон для
 *      типа документа (холодильник, морозильник, климат).
 *   2. **identical_streak** — у одного employee 5+ дней подряд
 *      идентичный data-blob (lazy copy-paste).
 *   3. **bulk_fill_burst** — в одном документе создано 10+ строк за
 *      < 60 секунд одним employee (массовое заполнение «всё за неделю
 *      одним кликом», а не реальная фиксация).
 *
 * Ответ — массив записей с пояснением + ссылкой на сам документ. UI
 * показывает виджет на дашборде; менеджер видит проблему и может
 * проверить руками.
 *
 * Доступно только management-ролям. Скан O(N) по entries за 14 дней,
 * без агрегатов в Prisma — для типичной org это 1-3к записей.
 */

type Severity = "warn" | "info";

type Anomaly = {
  kind: "temperature_out_of_range" | "identical_streak" | "bulk_fill_burst";
  severity: Severity;
  templateCode: string;
  templateName: string;
  documentId: string;
  documentTitle: string;
  employeeId: string;
  employeeName: string;
  /// Дата (для streak — последний день; для burst — день вспышки).
  date: string;
  /// Сжатый readable-message для UI (на русском).
  message: string;
  /// Доп.-контекст: например, актуальное значение температуры или
  /// длина streak'а. Для дебага.
  context: Record<string, string | number>;
};

const TEMPERATURE_FIELD_KEYS = ["temperature", "temp", "tempC", "t"];
const TEMPERATURE_RANGES: Record<string, { min: number; max: number; label: string }> = {
  cold_equipment_control: { min: -30, max: 12, label: "холодильное оборудование" },
  climate_control: { min: 5, max: 32, label: "климат-контроль" },
  fryer_oil: { min: 140, max: 200, label: "температура жира" },
};

function pickTemperature(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  for (const key of TEMPERATURE_FIELD_KEYS) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const cleaned = v.replace(",", ".").trim();
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * Считает значение «пустым» — null, undefined, "", " ", или объект
 * без значимых полей (все вложенные значения тоже пустые).
 * Используется streak-detector'ом, чтобы не считать «14 дней
 * пробелы / нули» подозрительной серией.
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return false;
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (k === "_autoSeeded") continue; // service marker — не значимое поле
      if (!isEmptyValue(v)) return false;
    }
    return true;
  }
  return false;
}

function stableHash(data: unknown): string {
  // Если в data только пустые/whitespace-значения — возвращаем
  // спец-маркер EMPTY. Streak-detector пропускает entries с этим
  // хешем — иначе «не заполненные подряд дни» считались бы
  // «одинаковыми значениями» (false positive).
  if (isEmptyValue(data)) return "__EMPTY__";
  if (data === null || data === undefined) return "null";
  if (typeof data !== "object") return JSON.stringify(data);
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => k !== "_autoSeeded")
    .sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (
    !hasFullWorkspaceAccess({
      role: session.user.role,
      isRoot: session.user.isRoot,
    })
  ) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 14);

  // Берём все записи за 14 дней по этой организации. Исключаем
  // _autoSeeded-плейсхолдеры (создаются при пересоздании документа,
  // ещё не заполнены сотрудником) — иначе streak-detector видит их
  // как «14 дней одинаковые» и шлёт ложные warning'и.
  const entries = await db.journalDocumentEntry.findMany({
    where: {
      date: { gte: start, lte: today },
      document: { organizationId },
      NOT: { data: { path: ["_autoSeeded"], equals: true } },
    },
    select: {
      id: true,
      date: true,
      data: true,
      createdAt: true,
      employeeId: true,
      documentId: true,
      employee: { select: { name: true } },
      document: {
        select: {
          id: true,
          title: true,
          template: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: [{ documentId: "asc" }, { employeeId: "asc" }, { date: "asc" }],
  });

  const anomalies: Anomaly[] = [];

  // 1. Temperature out of range — per-entry check.
  for (const e of entries) {
    const code = e.document.template.code;
    const range = TEMPERATURE_RANGES[code];
    if (!range) continue;
    const t = pickTemperature(e.data);
    if (t === null) continue;
    if (t < range.min || t > range.max) {
      anomalies.push({
        kind: "temperature_out_of_range",
        severity: "warn",
        templateCode: code,
        templateName: e.document.template.name,
        documentId: e.documentId,
        documentTitle: e.document.title,
        employeeId: e.employeeId,
        employeeName: e.employee.name,
        date: e.date.toISOString().slice(0, 10),
        message: `Температура ${t}°C вне допустимого диапазона для ${range.label} (${range.min}…${range.max}°C)`,
        context: { temperature: t, min: range.min, max: range.max },
      });
    }
  }

  // 2. Identical streak — для каждой пары (documentId, employeeId)
  // проходим по дням подряд и считаем максимальную последовательность с
  // одинаковым stableHash(data). Если ≥ 5 — флагуем последний день streak.
  const groupKey = (e: (typeof entries)[number]) =>
    `${e.documentId}::${e.employeeId}`;
  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = groupKey(e);
    const arr = grouped.get(k) ?? [];
    arr.push(e);
    grouped.set(k, arr);
  }

  for (const arr of grouped.values()) {
    // Фильтруем «пустые» entries — они не должны участвовать в
    // streak-детекции. Пустота — это не подозрительное копирование,
    // это просто незаполненные дни.
    const filled = arr.filter((e) => stableHash(e.data) !== "__EMPTY__");
    if (filled.length < 5) continue;
    // Уже отсортированы по date asc.
    let streak = 1;
    let lastHash = stableHash(filled[0].data);
    for (let i = 1; i < filled.length; i += 1) {
      const cur = stableHash(filled[i].data);
      if (cur === lastHash) {
        streak += 1;
      } else {
        // Streak end — flag if it was big enough.
        if (streak >= 5) {
          const tail = filled[i - 1];
          anomalies.push({
            kind: "identical_streak",
            severity: "info",
            templateCode: tail.document.template.code,
            templateName: tail.document.template.name,
            documentId: tail.documentId,
            documentTitle: tail.document.title,
            employeeId: tail.employeeId,
            employeeName: tail.employee.name,
            date: tail.date.toISOString().slice(0, 10),
            message: `${streak} дней подряд одинаковые значения — похоже на копирование вчера без проверки.`,
            context: { streakDays: streak },
          });
        }
        streak = 1;
        lastHash = cur;
      }
    }
    if (streak >= 5) {
      const tail = filled[filled.length - 1];
      anomalies.push({
        kind: "identical_streak",
        severity: "info",
        templateCode: tail.document.template.code,
        templateName: tail.document.template.name,
        documentId: tail.documentId,
        documentTitle: tail.document.title,
        employeeId: tail.employeeId,
        employeeName: tail.employee.name,
        date: tail.date.toISOString().slice(0, 10),
        message: `${streak} дней подряд одинаковые значения — похоже на копирование вчера без проверки.`,
        context: { streakDays: streak },
      });
    }
  }

  // 3. Bulk-fill burst — для каждого documentId+employeeId считаем,
  // сколько записей создано в окне 60 секунд. Если ≥ 10 — флаг.
  const burstGroup = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = groupKey(e);
    const arr = burstGroup.get(k) ?? [];
    arr.push(e);
    burstGroup.set(k, arr);
  }
  for (const arr of burstGroup.values()) {
    const sorted = [...arr].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    let i = 0;
    while (i < sorted.length) {
      const window: typeof sorted = [sorted[i]];
      let j = i + 1;
      while (
        j < sorted.length &&
        sorted[j].createdAt.getTime() - sorted[i].createdAt.getTime() <= 60_000
      ) {
        window.push(sorted[j]);
        j += 1;
      }
      if (window.length >= 10) {
        const head = window[0];
        const span = Math.round(
          (window[window.length - 1].createdAt.getTime() -
            head.createdAt.getTime()) /
            1000
        );
        anomalies.push({
          kind: "bulk_fill_burst",
          severity: "info",
          templateCode: head.document.template.code,
          templateName: head.document.template.name,
          documentId: head.documentId,
          documentTitle: head.document.title,
          employeeId: head.employeeId,
          employeeName: head.employee.name,
          date: head.createdAt.toISOString().slice(0, 10),
          message: `Создано ${window.length} строк за ${span === 0 ? "<1" : span} секунд — массовое заполнение, а не реальная фиксация.`,
          context: { entries: window.length, spanSeconds: span },
        });
        i = j;
      } else {
        i += 1;
      }
    }
  }

  // Сортируем: warn → info, потом дата desc.
  anomalies.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "warn" ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  return NextResponse.json({
    scanned: entries.length,
    anomalies,
    windowDays: 14,
  });
}
