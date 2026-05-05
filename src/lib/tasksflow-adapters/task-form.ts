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
      /** Pre-fill значение при открытии (для редактирования уже сохранённой
       *  записи журнала: kepp prior values). */
      defaultValue?: string;
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
      /** Pre-fill значение при открытии. */
      defaultValue?: number | string;
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
      defaultValue?: string;
    };

/**
 * Шаг pipeline'а в форме task-fill. Каждый шаг — мини-инструкция
 * («что сделать») + чекбокс «Сделал». Worker не может перейти к
 * следующему шагу пока не отметил текущий.
 *
 * Опциональное `field` позволяет внутри шага собрать данные (напр.
 * температура, наблюдения) — но обычно достаточно простого confirm.
 *
 * Источник: для большинства журналов pipeline собирается автоматом
 * из `journal-filling-guides[code].steps[]`. Для специальных
 * (бракераж, охлаждение) — кастомный pipeline в адаптере.
 */
export type PipelineStep = {
  /** Стабильный ID — используется для AuditLog details.stepId. */
  id: string;
  /** Заголовок шага (что делать). Краткий, glanceable. */
  title: string;
  /** Подробное объяснение «как сделать», с конкретикой. */
  detail: string;
  /** Опциональное поле для ввода данных в этом шаге. */
  field?: TaskFormField;
  /** СанПиН-ссылка или подсказка по конкретному шагу. */
  hint?: string;
  /**
   * Если true — для подтверждения шага worker обязан загрузить фото.
   * Включается через org-настройку `requirePhotoOnTaskFillStep`. Без
   * фото кнопка «Сделал» заблокирована. Фото сохраняется в /uploads
   * и URL прикрепляется к pipeline-trail для evidence-аудита.
   *
   * Используется для legacy (filling-guides + org-flag).
   * Pipeline-tree (P1.1+) использует `photoMode` ниже — он богаче
   * (none/optional/required). Если оба заданы, `photoMode` побеждает.
   */
  requirePhoto?: boolean;
  /**
   * P1.6 — per-node photo policy из pipeline-tree.
   *   - "none"      — фото не показываем
   *   - "optional"  — uploader виден, но «Сделал» не блокирует
   *   - "required"  — uploader виден, «Сделал» заблокирована до загрузки
   */
  photoMode?: "none" | "optional" | "required";
  /**
   * P1.6 — обязательный текстовый комментарий на этом шаге.
   * Если true — рендерим textarea, «Сделал» заблокирована до non-empty.
   */
  requireComment?: boolean;
  /**
   * P1.6 — обязательная подпись (ФИО) на шаге.
   * Если true — рендерим input, «Сделал» заблокирована до non-empty.
   */
  requireSignature?: boolean;
  /**
   * P1.7 — глубина в дереве: 0 = root, 1 = subtask, 2 = sub-subtask.
   * Wizard рендерит indent (marginLeft) пропорционально depth.
   * Используется только для визуального indent — порядок шагов
   * сохраняется через flatten в адаптере.
   */
  depth?: number;
};

export type TaskFormSchema = {
  /** Rendered above the form — free-text task description from admin
   *  is concatenated on top of this. Optional. */
  intro?: string;
  fields: TaskFormField[];
  /**
   * Опциональный пошаговый pipeline. Если задан, task-fill UI
   * рендерит wizard вместо одной формы:
   *   1. Каждый шаг показывается как карточка с заголовком + детальным
   *      описанием.
   *   2. Worker подтверждает «Сделал» — пишется AuditLog,
   *      переключается следующий шаг.
   *   3. После всех шагов — форма с `fields` (если есть) + комментарий
   *      + Готово.
   *
   * Без pipeline — поведение прежнее (одна форма с fields).
   */
  pipeline?: PipelineStep[];
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
        // Принимаем русские запятые («20,1»), пустые строки, null —
        // не валим валидацию, превращаем в число или undefined.
        // Без этого Number("20,1") === NaN → z.coerce.number() ругался
        // «expected number, received NaN» когда поле было заполнено
        // через мобильную клавиатуру с локалью RU.
        //
        // 1. .min/.max применяем к z.number() ДО оборачивания
        //    preprocess'ом — после preprocess это ZodEffects, у
        //    которого нет .min (см. прод-краш f242c26).
        // 2. .optional().nullable() применяем ВНУТРИ preprocess'а —
        //    чтобы пустое значение, превращённое в undefined,
        //    корректно проходило optional. Иначе на required=false
        //    полях падает «expected number, received undefined»
        //    при пустом submit (см. прод-краш 0744c1d).
        let inner: z.ZodTypeAny = z.number();
        if (typeof field.min === "number")
          inner = (inner as z.ZodNumber).min(field.min);
        if (typeof field.max === "number")
          inner = (inner as z.ZodNumber).max(field.max);
        if (!field.required) inner = inner.optional().nullable();

        shape[field.key] = z.preprocess((value) => {
          if (value === "" || value === null || value === undefined) {
            return undefined;
          }
          if (typeof value === "string") {
            const normalized = value.trim().replace(",", ".");
            if (normalized === "") return undefined;
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : undefined;
          }
          if (typeof value === "number") {
            return Number.isFinite(value) ? value : undefined;
          }
          return value;
        }, inner);
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
