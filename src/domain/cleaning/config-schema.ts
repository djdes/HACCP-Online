/**
 * Zod-схема для `JournalDocument.config` журнала уборки. Источник правды
 * для структуры — все read/write через `parseCleaningConfig` чтобы
 * поймать дрейф в момент чтения, а не в runtime UI'е.
 *
 * См. spec: docs/superpowers/specs/01-architecture.md (anti-pattern
 * «Update of JSON config без zod-parse»).
 *
 * Расположение в `src/domain/cleaning` отражает целевую слоистую
 * структуру (см. spec). Файл — pure logic, zero внешних зависимостей
 * кроме `zod`.
 */
import { z } from "zod";

const cleaningMatrixValueSchema = z.string(); // "T" | "G" | "/" | "" | initials

const cleaningRoomItemSchema = z.object({
  id: z.string(),
  areaId: z.string().nullable().optional(),
  name: z.string(),
  detergent: z.string().optional().default(""),
  currentScope: z.array(z.string()).optional().default([]),
  generalScope: z.array(z.string()).optional().default([]),
  currentDays: z.number().int().min(0).max(127).optional(),
  generalDays: z.number().int().min(0).max(127).optional(),
});

const cleaningResponsibleSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  title: z.string().optional(),
  userId: z.string().nullable().optional(),
  userName: z.string().optional(),
});

const cleaningResponsiblePairSchema = z.object({
  id: z.string(),
  cleaningTitle: z.string().optional().default(""),
  cleaningUserId: z.string().nullable().optional(),
  cleaningUserName: z.string().optional().default(""),
  controlTitle: z.string().optional().default(""),
  controlUserId: z.string().nullable().optional(),
  controlUserName: z.string().optional().default(""),
});

export const cleaningConfigSchema = z.object({
  // Mode discriminator (cleaning-unification 2026-05-08)
  cleaningMode: z.enum(["pairs", "rooms"]).optional(),
  cleaningSubtaskMode: z.enum(["perRoom", "global", "legacy"]).optional(),

  // Rooms-mode core fields
  selectedRoomIds: z.array(z.string()).optional().default([]),
  selectedCleanerUserIds: z.array(z.string()).optional().default([]),
  controlUserId: z.string().nullable().optional(),
  verifierByRoomId: z.record(z.string(), z.string()).optional().default({}),
  roomsRaceMode: z.boolean().optional(),

  // Pairs-mode legacy
  responsiblePairs: z.array(cleaningResponsiblePairSchema).optional().default([]),

  // Per-doc CleaningRoomItem (legacy в rooms-mode, основной в pairs-mode)
  rooms: z.array(cleaningRoomItemSchema).optional().default([]),

  // Matrix — фактические отметки T/G/«/» по (roomId, dateKey)
  matrix: z
    .record(z.string(), z.record(z.string(), cleaningMatrixValueSchema))
    .optional()
    .default({}),

  // Backwards-compat alias matrix == marks. Не пишем дважды, но parse
  // принимает.
  marks: z
    .record(z.string(), z.record(z.string(), cleaningMatrixValueSchema))
    .optional(),

  // Responsibles (отдельно от pairs)
  cleaningResponsibles: z
    .array(cleaningResponsibleSchema)
    .optional()
    .default([]),
  controlResponsibles: z.array(cleaningResponsibleSchema).optional().default([]),

  // Title / metadata
  title: z.string().optional().default(""),
  documentTitle: z.string().optional().default(""),

  // Skip weekends + auto-fill settings
  skipWeekends: z.boolean().optional().default(false),
  autoFill: z
    .object({
      enabled: z.boolean().optional().default(false),
      skipWeekends: z.boolean().optional().default(false),
      fillUntilToday: z.boolean().optional().default(true),
      defaultRoomMark: cleaningMatrixValueSchema.optional().default("T"),
    })
    .optional(),

  // Legacy / non-essential поля — не валидируем строго, passthrough
  ventilationEnabled: z.boolean().optional(),
  legend: z.array(z.string()).optional(),
  referenceTable: z.array(z.unknown()).optional(),
  schedule: z.unknown().optional(),
  procedure: z.unknown().optional(),
  responsiblePersons: z.array(z.unknown()).optional(),
  periodicity: z.unknown().optional(),
  settings: z.unknown().optional(),
});

export type CleaningConfig = z.infer<typeof cleaningConfigSchema>;
export type CleaningRoomItem = z.infer<typeof cleaningRoomItemSchema>;
export type CleaningResponsiblePair = z.infer<
  typeof cleaningResponsiblePairSchema
>;

/**
 * Безопасный parse — never throws, возвращает либо объект, либо
 * defaults. Используйте когда не уверены в форме (например read из
 * legacy-документа). Логируйте zod-issue для отладки.
 */
export function parseCleaningConfigSafe(
  raw: unknown,
): { ok: true; data: CleaningConfig } | { ok: false; issues: z.ZodIssue[] } {
  const r = cleaningConfigSchema.safeParse(raw ?? {});
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, issues: r.error.issues };
}

/**
 * Strict parse — throws on invalid. Используйте на write-path где
 * хотим гарантировать чистоту записи в БД.
 */
export function parseCleaningConfigStrict(raw: unknown): CleaningConfig {
  return cleaningConfigSchema.parse(raw ?? {});
}
