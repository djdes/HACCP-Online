/**
 * Declarative form schema for «Журнальный режим» tasks.
 *
 * TasksFlow renders these as regular form inputs for the employee on
 * the task detail screen. When the employee submits, the `values` blob
 * flies back to WeSetup and the adapter's `applyCompletion` maps it to
 * the journal's native entry shape.
 *
 * Adding a new field type:
 *   1. Add a variant here
 *   2. Teach the TasksFlow renderer about it
 *   3. Teach the completion-validation zod schema in
 *      `validateCompletionValues` below
 *
 * Keep the DSL narrow on purpose — every field type has to work on a
 * cashier's budget Android, so no fancy widgets.
 */
import { z } from "zod";

export type TaskFormOption = {
  value: string;
  label: string;
  /**
   * Short code used on printed journals (e.g. "Зд." for «Здоров»).
   * Non-displayed in the form; kept so the response can be rendered in
   * a confirmation dialog with the same abbreviation the manager
   * recognises from paper journals.
   */
  code?: string;
};

export type TaskFormField =
  | {
      type: "text";
      key: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      multiline?: boolean;
      maxLength?: number;
    }
  | {
      type: "number";
      key: string;
      label: string;
      required?: boolean;
      unit?: string;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      type: "boolean";
      key: string;
      label: string;
      /** Default checked state when the form first renders. */
      defaultValue?: boolean;
    }
  | {
      type: "select";
      key: string;
      label: string;
      required?: boolean;
      options: TaskFormOption[];
      /** Default selected value. */
      defaultValue?: string;
    }
  | {
      type: "date";
      key: string;
      label: string;
      required?: boolean;
    };

export type TaskFormSchema = {
  /** Rendered above the form — free-text task description from admin
   *  is concatenated on top of this. Optional. */
  intro?: string;
  fields: TaskFormField[];
  /**
   * Validates the responder's payload against the schema. Called on
   * the server before handing to `applyCompletion`. Returns sanitized
   * shape; throws on invalid.
   */
  submitLabel?: string;
};

export type TaskFormValues = Record<string, string | number | boolean | null>;

/**
 * Runtime validator built from a schema. TasksFlow clients should rely
 * on this server-side — client-side validation is a UX hint, not a
 * source of truth.
 */
export function buildCompletionValidator(
  schema: TaskFormSchema
): z.ZodType<TaskFormValues> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of schema.fields) {
    switch (field.type) {
      case "text": {
        let s: z.ZodTypeAny = z.string().trim();
        if (field.maxLength) s = (s as z.ZodString).max(field.maxLength);
        if (!field.required) s = s.optional().nullable();
        else s = (s as z.ZodString).min(1, `${field.label}: обязательное поле`);
        shape[field.key] = s;
        break;
      }
      case "number": {
        let s: z.ZodTypeAny = z.coerce.number();
        if (typeof field.min === "number")
          s = (s as z.ZodNumber).min(field.min);
        if (typeof field.max === "number")
          s = (s as z.ZodNumber).max(field.max);
        if (!field.required) s = s.optional().nullable();
        shape[field.key] = s;
        break;
      }
      case "boolean": {
        shape[field.key] = z.coerce.boolean().optional().nullable();
        break;
      }
      case "select": {
        const allowed = field.options.map((o) => o.value);
        let s: z.ZodTypeAny = z.enum(
          allowed as unknown as [string, ...string[]]
        );
        if (!field.required) s = s.optional().nullable();
        shape[field.key] = s;
        break;
      }
      case "date": {
        const rx = /^\d{4}-\d{2}-\d{2}$/;
        let s: z.ZodTypeAny = z
          .string()
          .regex(rx, "Дата должна быть в формате YYYY-MM-DD");
        if (!field.required) s = s.optional().nullable();
        shape[field.key] = s;
        break;
      }
    }
  }
  return z.object(shape).passthrough() as unknown as z.ZodType<TaskFormValues>;
}
