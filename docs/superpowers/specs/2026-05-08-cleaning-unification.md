# Cleaning Journal Unification — Spec

**Date:** 2026-05-08
**Owner:** djdes / bugdenes@gmail.com
**Status:** Approved → in implementation
**Trigger:** Юзер: «Используй superpowers ... почему теперь pipeline настройки не работают, и почему когда я захотел изменить данные там вообще другая форма вылезла. Давай максимально обдумаем как оптимизировать процесс с журналом уборки».

## Problem

У уборки **11 параллельных источников правды** про помещения и pipeline.
Менеджер не понимает где редактировать и почему изменение в одном месте
не отражается в другом. Конкретные баги:

1. `/settings/journal-pipelines/cleaning` пишет в `JournalPipelineTemplate` —
   cleaning-adapter `getTaskForm` это игнорирует, читает из `config.rooms[i]`.
2. Для редактирования помещения существуют ≥3 разных диалога:
   - Карандаш в журнале → `RoomFormState` (scope+days+detergent)
   - `/settings/buildings` → только name+kind
   - `/settings/journal-checklists/cleaning` → label+frequency

## Approved approach: **Centralization (variant A)**

`Room` (DB-модель из `/settings/buildings`) становится единственной точкой
правды о помещении. Журнал уборки — отображение матрицы + completion,
**читает scope из Room**.

### Schema change

Расширяем `Room`:

```prisma
model Room {
  // existing
  id           String   @id @default(cuid())
  buildingId   String
  name         String
  kind         String   @default("other")
  sortOrder    Int      @default(0)

  // NEW for cleaning unification
  detergent     String?      @default("")
  /// Bullet-list шагов «Текущая уборка». Каждый шаг = пункт чек-листа в TF.
  currentScope  Json         @default("[]")
  /// Bullet-list шагов «Генеральная уборка».
  generalScope  Json         @default("[]")
  /// Weekday bitmask: bit 0=Пн, 1=Вт, ... 6=Вс. По умолчанию 127 (ежедневно).
  currentDays   Int          @default(127)
  /// Weekday bitmask. По умолчанию 0 (только вручную / overwrite plan).
  generalDays   Int          @default(0)
}
```

JSON для `currentScope`/`generalScope` (а не `String[]`) — Prisma 7 string-array
support неравномерный, JSON стабильнее и гибче (можно потом добавить `{label, hint}`).

### Single Room editor component

Создать `src/components/settings/room-editor.tsx`:

```tsx
type RoomEditorProps = {
  room: Room | null; // null → создание
  onSave: (patch: { name, kind, detergent, currentScope, generalScope,
                    currentDays, generalDays }) => Promise<void>;
  onCancel: () => void;
};
```

Используется и в:
- `/settings/buildings` (через buildings-client) — full edit
- `cleaning-document-client` (карандаш у строки) — same dialog
- `/settings/buildings/[id]` deeplink (если кто-то даст ссылку)

### Cleaning journal reads from Room

`cleaning-document-client.tsx`:
- Rows builder в rooms-mode уже использует `selectedRoomIds + buildings`.
  Дополняем: для каждого selectedRoomId берём детали (scope, days, detergent)
  из `Room`, не из `config.rooms[i]`.
- `config.rooms[]` помечается как **legacy** — оставляем для совместимости
  старых документов (pairs-mode), но НЕ пишем туда новые данные.
- Карандаш у строки в rooms-mode → открывает `<RoomEditor>` с `Room` из БД.
  Сохранение → PUT `/api/settings/rooms/[id]` (новый эндпоинт), а не PATCH
  journal-document.

### TF integration reads from Room

- `cleaning-adapter.getTaskForm(rowKey)` парсит roomId, грузит Room из БД,
  возвращает pipeline по `Room.currentScope` или `Room.generalScope` в
  зависимости от matrix-значения сегодня (T/G).
- `cleaning-cell-override-sync.syncCleaningCellOverride` — то же самое
  (читает Room.scope, не config.rooms).
- `applyRoomScheduleToMatrix` — читает `Room.currentDays`/`generalDays`
  для всех selectedRoomIds, не из config.rooms.
- `/api/task-fill/[taskId]/checklist` — продолжает фильтровать
  `JournalChecklistItem` по category, но синхронизация `Room.scope` →
  `JournalChecklistItem` происходит автоматически по hook'у на save Room.

### Migration

1. **Schema migration** (additive, safe): `npx prisma db push` через
   deploy.yml. Все колонки имеют default.

2. **Backfill seed** (`prisma/seed-room-cleaning-fields.ts`):
   - Для каждой `Organization` пробегаем активные cleaning-документы.
   - Для каждой `CleaningRoomItem` в config.rooms[]: ищем `Room` с тем же
     `id` (если был связан через `/settings/buildings`) или матчим по
     `name` (для legacy pairs-mode где id произвольный).
   - Если Room найден И его `currentScope`/`generalScope` пусты — копируем.
   - Если не найден И есть Building — создаём Room автоматически.
   - Если есть в config.rooms но нет соответствующего Building — пропускаем
     (legacy pairs-mode без Building'ов: оставляем работать на config.rooms,
     юзер сам перенесёт когда захочет).
   - Идемпотентно: повторный прогон ничего не дублирует.

3. **Hide deprecated paths**:
   - `/settings/journal-pipelines` для cleaning → плашка «Не применимо для
     матричных журналов. Настройка через /settings/buildings».
   - `/settings/journal-checklists/cleaning` → аналогично или редирект.

### What stays in config

Per-document данные журнала остаются в `JournalDocument.config`:
- `selectedRoomIds[]` — какие комнаты в этом журнале
- `selectedCleanerUserIds[]` — кто из уборщиков может работать
- `responsiblePairs[]` (legacy pairs-mode)
- `controlUserId`, `verifierByRoomId` — кто контролирует
- `cleaningMode`, `roomsRaceMode`
- `matrix` — фактические T/G/«/» по ячейкам
- `marks` — backwards-compat alias

Это всё про конкретный документ-период, а не про физическое помещение.

## Implementation Stages

| Stage | Scope | Status | Commit |
|-------|-------|--------|--------|
| 1 | Schema: Room +detergent/scope/days; backfill seed; deploy.yml | ✅ DONE | 3c96b309 |
| 2 | Shared `<RoomEditor>` (extracted ScopeListEditor + WeekdayMaskPicker) | ⏳ DEFERRED | — |
| 3 | `/settings/buildings` использует RoomEditor | ⏳ DEFERRED (depends on 2) | — |
| 4 | Cleaning journal: rows из Room; submitRoom write-through на Room | ✅ DONE | 93455d02 |
| 5 | TF integration: getTaskForm читает Room (fallback config) | ✅ DONE | 93455d02 |
| 6 | Auto-sync Room.scope → JournalChecklistItem on PATCH /api/settings/rooms | ✅ DONE | next commit |
| 7 | Hide cleaning from `/settings/journal-pipelines`+`/journal-checklists` | ⏳ DEFERRED | — |
| 8 | Deprecate config.rooms[] (rooms-mode default, pairs-mode legacy) | ⏳ DEFERRED | — |

### Why 2/3/7/8 deferred

- **Stage 2/3**: ScopeListEditor + WeekdayMaskPicker сейчас inline в
  cleaning-document-client.tsx (2000+ lines). Чистое extracting в
  отдельный модуль = ~30 минут аккуратной работы; стоит делать когда
  пользователь конкретно жалуется на /settings/buildings UX. Сейчас
  редактирование scope/days работает через журнал-pencil (stage 4),
  данные пишутся в Room (stage 4 write-through), и /settings/buildings
  показывает только name+kind. Не идеально, но не блокер.
- **Stage 7**: hiding cleaning из journal-pipelines + journal-checklists
  — UX-косметика. Текущее поведение: эти страницы СЕЙЧАС не работают
  для cleaning (показывают пустые редакторы), но молча. Можно показать
  редирект-плашку «настройка через /settings/buildings» в одну строчку
  кода, но не критично.
- **Stage 8**: deprecate config.rooms[] для новых документов —
  компромисс между чистотой и риском поломать существующие pairs-mode
  документы. Текущие документы продолжают работать одинаково; новые
  идут с cleaningMode='rooms' (уже default? проверить).

## Backwards compatibility

- Старые pairs-mode документы продолжают работать на `config.rooms[]`.
  Если у org есть pairs-mode docs И rooms-mode docs одновременно —
  это OK, они независимы.
- Документы без selectedRoomIds (только pairs-mode) не получают
  Room.scope-based pipeline в TF — fallback на config.rooms[i] логику
  (текущая ветка в getTaskForm `if (pair) buildPairsCleaningForm`).
- `JournalChecklistItem` в БД остаются для legacy /settings/journal-checklists
  flow (другие журналы используют это).

## Memory anchor

Памятка `cleaning-unification-spec.md` в `~/.claude/.../memory/` указывает
на этот документ — будущий агент находит его при «restart» и продолжает
с stage X.

## Reference points

- Bug-trigger commits: my recent runs trying to fix cleaning UX —
  `e0684924`, `b3471ef7`, `5e9f323a`, `d1d3171e`, `421dd8c1`.
- Adapters/cleaning entry: `src/lib/tasksflow-adapters/cleaning.ts`
- Override sync: `src/lib/cleaning-cell-override-sync.ts`
- Schedule logic: `src/lib/cleaning-document.ts:applyRoomScheduleToMatrix`
- Checklist filter: `src/app/api/task-fill/[taskId]/checklist/route.ts`
- Doc UI: `src/components/journals/cleaning-document-client.tsx` (~2000+ lines)
- Buildings UI: `src/app/(dashboard)/settings/buildings/buildings-client.tsx`
