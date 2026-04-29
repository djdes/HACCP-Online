import { db } from "@/lib/db";

/**
 * Валидаторы и побочные эффекты при completion claim'а для каждого
 * журнала. Принимают form-payload (data) и контекст scope, возвращают
 * { ok, errors[], warnings[], side_effects[] }.
 *
 * Используются:
 *   - на endpoint /api/journal-task-claims/[id] complete (если payload
 *     передан) — отказывает completion если errors есть.
 *   - в адаптере TasksFlow при applyRemoteCompletion с form values.
 *
 * Side-effects:
 *   - "create_capa": автоматически открывает CAPA-тикет при out-of-range
 *     температуре, тёмном масле и т.п.
 *   - "telegram_alert": нотифицирует менеджера через TG.
 */

export type ValidationResult = {
  ok: boolean;
  errors: { field?: string; message: string }[];
  warnings: { field?: string; message: string }[];
  sideEffects: SideEffect[];
};

export type SideEffect =
  | { kind: "create_capa"; title: string; severity: "low" | "medium" | "high"; data?: Record<string, unknown> }
  | { kind: "telegram_alert"; recipients: "managers" | "owners"; message: string };

export type ScopeContext = {
  organizationId: string;
  journalCode: string;
  scopeKey: string;
  scopeLabel: string;
  userId: string;
  userName: string | null;
  data: Record<string, unknown>;
};

/**
 * Главный validator dispatcher.
 */
export async function validateCompletion(ctx: ScopeContext): Promise<ValidationResult> {
  switch (ctx.journalCode) {
    case "cold_equipment_control":
      return validateColdEquipment(ctx);
    case "climate_control":
      return validateClimate(ctx);
    case "fryer_oil":
      return validateFryerOil(ctx);
    case "hygiene":
    case "health_check":
      return validateHygiene(ctx);
    case "incoming_control":
      return validateIncoming(ctx);
    case "finished_product":
      return validateFinishedProduct(ctx);
    default:
      return { ok: true, errors: [], warnings: [], sideEffects: [] };
  }
}

/* ---------- per-journal ---------- */

async function validateColdEquipment(ctx: ScopeContext): Promise<ValidationResult> {
  const t = numField(ctx.data, ["temperature", "temp", "tempC"]);
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];
  const sideEffects: SideEffect[] = [];

  if (t === null) {
    errors.push({ field: "temperature", message: "Не указана температура" });
    return { ok: false, errors, warnings, sideEffects };
  }

  // Извлекаем equipmentId из scopeKey: fridge:<id>:<shift>:<date>
  const m = /^fridge:([^:]+):/.exec(ctx.scopeKey);
  let tempMin = -30;
  let tempMax = 12;
  let equipmentName = "холодильник";
  if (m) {
    const eq = await db.equipment.findUnique({
      where: { id: m[1] },
      select: { name: true, tempMin: true, tempMax: true },
    });
    if (eq) {
      equipmentName = eq.name;
      if (eq.tempMin !== null) tempMin = eq.tempMin;
      if (eq.tempMax !== null) tempMax = eq.tempMax;
    }
  }

  if (t < tempMin || t > tempMax) {
    const correctiveAction = stringField(ctx.data, ["correctiveAction"]);
    if (!correctiveAction || correctiveAction.trim().length < 5) {
      errors.push({
        field: "correctiveAction",
        message: `Температура ${t}°C вне диапазона (${tempMin}…${tempMax}°C). Опишите корректирующие действия (минимум 5 символов).`,
      });
    } else {
      warnings.push({
        message: `Температура ${t}°C вне диапазона (${tempMin}…${tempMax}°C). Создан CAPA, менеджер уведомлён.`,
      });
      sideEffects.push({
        kind: "create_capa",
        title: `${equipmentName}: температура ${t}°C вне диапазона (${tempMin}…${tempMax}°C)`,
        severity: "high",
        data: {
          equipmentId: m?.[1],
          temperature: t,
          tempMin,
          tempMax,
          correctiveAction,
          actionBy: ctx.userName,
        },
      });
      sideEffects.push({
        kind: "telegram_alert",
        recipients: "managers",
        message:
          `🚨 <b>Температура ${equipmentName}: ${t}°C</b>\n` +
          `Диапазон: ${tempMin}…${tempMax}°C\n` +
          `Сотрудник: ${ctx.userName ?? ""}\n` +
          `Действие: ${correctiveAction}`,
      });
    }
  }
  return { ok: errors.length === 0, errors, warnings, sideEffects };
}

async function validateClimate(ctx: ScopeContext): Promise<ValidationResult> {
  const t = numField(ctx.data, ["temperature", "temp"]);
  const h = numField(ctx.data, ["humidity"]);
  const errors: ValidationResult["errors"] = [];
  if (t === null) errors.push({ field: "temperature", message: "Не указана температура" });
  if (h === null)
    errors.push({ field: "humidity", message: "Не указана влажность" });
  const warnings: ValidationResult["warnings"] = [];
  // Нормы для пищевых производств: t = +5..+32°C, h = 30-75%.
  if (t !== null && (t < 5 || t > 32)) {
    warnings.push({ message: `Температура ${t}°C вне нормы (+5…+32°C)` });
  }
  if (h !== null && (h < 30 || h > 75)) {
    warnings.push({ message: `Влажность ${h}% вне нормы (30–75%)` });
  }
  return { ok: errors.length === 0, errors, warnings, sideEffects: [] };
}

async function validateFryerOil(ctx: ScopeContext): Promise<ValidationResult> {
  const t = numField(ctx.data, ["temperatureC", "temperature"]);
  const polar = numField(ctx.data, ["polarCompoundsPercent"]);
  const replaced = boolField(ctx.data, ["replaced"]);
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];
  const sideEffects: SideEffect[] = [];

  if (t !== null && (t < 140 || t > 200)) {
    warnings.push({ message: `Температура жира ${t}°C вне нормы 140–200°C` });
  }
  if (polar !== null && polar > 25) {
    if (!replaced) {
      errors.push({
        field: "replaced",
        message: `Полярные соединения ${polar}% > 25% — требуется замена масла. Подтвердите чекбоксом.`,
      });
    } else {
      sideEffects.push({
        kind: "create_capa",
        title: `Замена фритюрного жира — полярные соединения ${polar}%`,
        severity: "medium",
        data: { polar, replaced, by: ctx.userName },
      });
    }
  }
  return { ok: errors.length === 0, errors, warnings, sideEffects };
}

async function validateHygiene(ctx: ScopeContext): Promise<ValidationResult> {
  // Hygiene scope = «осмотр смены», entries создаются батчем для всех
  // сотрудников. Валидация — что хотя бы у одного employee есть запись.
  const entries = arrField(ctx.data, ["entries"]);
  const errors: ValidationResult["errors"] = [];
  const sideEffects: SideEffect[] = [];
  if (entries.length === 0) {
    errors.push({ message: "Не указано ни одного сотрудника в осмотре" });
  }
  for (const e of entries) {
    if (typeof e === "object" && e !== null) {
      const obj = e as Record<string, unknown>;
      if (typeof obj.temperatureC === "number" && obj.temperatureC > 37) {
        sideEffects.push({
          kind: "telegram_alert",
          recipients: "managers",
          message: `⚠️ Сотрудник ${obj.name ?? ""}: температура ${obj.temperatureC}°C — не допущен к работе`,
        });
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings: [], sideEffects };
}

async function validateIncoming(ctx: ScopeContext): Promise<ValidationResult> {
  const supplier = stringField(ctx.data, ["supplier"]);
  const productName = stringField(ctx.data, ["productName"]);
  const accepted = boolField(ctx.data, ["accepted"]);
  const errors: ValidationResult["errors"] = [];
  if (!supplier) errors.push({ field: "supplier", message: "Поставщик не указан" });
  if (!productName) errors.push({ field: "productName", message: "Наименование товара не указано" });
  if (accepted === false) {
    const reason = stringField(ctx.data, ["rejectionReason"]);
    if (!reason) {
      errors.push({
        field: "rejectionReason",
        message: "Если товар отклонён — укажите причину",
      });
    }
  }
  return { ok: errors.length === 0, errors, warnings: [], sideEffects: [] };
}

async function validateFinishedProduct(ctx: ScopeContext): Promise<ValidationResult> {
  const dish = stringField(ctx.data, ["dish"]);
  const tasteOk = boolField(ctx.data, ["tasteOk"]);
  const errors: ValidationResult["errors"] = [];
  const sideEffects: SideEffect[] = [];
  if (!dish) errors.push({ field: "dish", message: "Не указано блюдо" });
  if (tasteOk === false) {
    sideEffects.push({
      kind: "create_capa",
      title: `Бракераж: ${dish ?? "блюдо"} — органолептика не соответствует`,
      severity: "high",
    });
  }
  return { ok: errors.length === 0, errors, warnings: [], sideEffects };
}

/* ---------- helpers ---------- */

function numField(data: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", ".").trim());
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function stringField(data: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

function boolField(data: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "boolean") return v;
  }
  return null;
}

function arrField(data: Record<string, unknown>, keys: string[]): unknown[] {
  for (const k of keys) {
    const v = data[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}
