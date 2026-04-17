/**
 * Pure parsing / validation helpers for the Telegram journal wizard.
 *
 * Lives in src/lib so the node-only poller can import it via its tsx
 * bundle (no Next.js runtime needed), and so a plain tsx test script can
 * round-trip the validators without spinning up grammy.
 */

export type FieldDef = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  step?: number;
};

export function parseFields(raw: unknown): FieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    if (typeof f.key !== "string" || typeof f.type !== "string") continue;
    out.push({
      key: f.key,
      label: typeof f.label === "string" ? f.label : f.key,
      type: f.type,
      required: f.required === true,
      options: Array.isArray(f.options)
        ? (f.options as Array<{ value: string; label: string }>).filter(
            (o) => o && typeof o.value === "string" && typeof o.label === "string"
          )
        : undefined,
      step: typeof f.step === "number" ? f.step : undefined,
    });
  }
  return out;
}

/**
 * Parse user-typed date into ISO (YYYY-MM-DD). Accepts:
 *   - "сегодня" / "today"
 *   - "вчера" / "yesterday"
 *   - "DD.MM.YYYY", "DD-MM-YYYY", "DD/MM/YYYY"
 *   - "YYYY-MM-DD"
 */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateInput(s: string): string | null {
  const v = s.trim().toLowerCase();
  if (!v) return null;
  if (v === "сегодня" || v === "today") {
    return formatLocalYmd(new Date());
  }
  if (v === "вчера" || v === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatLocalYmd(d);
  }
  const m = v.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (m) {
    const [, dStr, moStr, yStr] = m;
    const d = Number(dStr);
    const mo = Number(moStr);
    const y = Number(yStr);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== d
    ) {
      return null;
    }
    return formatLocalYmd(dt);
  }
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, mo, d] = iso;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    if (
      dt.getFullYear() !== Number(y) ||
      dt.getMonth() !== Number(mo) - 1 ||
      dt.getDate() !== Number(d)
    ) {
      return null;
    }
    return v;
  }
  return null;
}

/**
 * Parse number — accepts comma or dot as decimal separator. Rejects empty.
 */
export function parseNumberInput(s: string): number | null {
  const v = s.replace(",", ".").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate a single field value already stored in `data`. Returns a
 * user-facing error string (in Russian) or null if the value is ok.
 * Skipped values are represented by `undefined` — ok when the field is
 * optional, error when required.
 */
export function validateFieldValue(
  field: FieldDef,
  value: unknown
): string | null {
  const missing =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "");
  if (missing) {
    return field.required ? "Обязательное поле" : null;
  }
  switch (field.type) {
    case "text":
      if (typeof value !== "string") return "Ожидается текст";
      return null;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value))
        return "Ожидается число";
      return null;
    case "boolean":
      if (typeof value !== "boolean") return "Ожидается да / нет";
      return null;
    case "date": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return "Ожидается дата ГГГГ-ММ-ДД";
      return null;
    }
    case "select":
      if (typeof value !== "string") return "Выберите вариант";
      if (field.options && !field.options.some((o) => o.value === value))
        return "Вариант не из списка";
      return null;
    case "employee":
    case "equipment":
      if (typeof value !== "string" || value.length === 0)
        return "Выберите из списка";
      return null;
    default:
      return null;
  }
}

/**
 * Collect labels of fields that are required but missing / invalid.
 */
export function findMissingRequired(
  fields: FieldDef[],
  data: Record<string, unknown>
): string[] {
  const missing: string[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    const err = validateFieldValue(f, data[f.key]);
    if (err) missing.push(f.label);
  }
  return missing;
}

/**
 * Validate every field (not just required ones). Returns a map of
 * field.label → error message; empty object means ok.
 */
export function validateAll(
  fields: FieldDef[],
  data: Record<string, unknown>
): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of fields) {
    const err = validateFieldValue(f, data[f.key]);
    if (err) errs[f.label] = err;
  }
  return errs;
}

/**
 * Russian pluralisation for «поле» / «поля» / «полей».
 */
export function pluralFields(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "полей";
  if (last === 1) return "поле";
  if (last >= 2 && last <= 4) return "поля";
  return "полей";
}
