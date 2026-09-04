# Task Spec: room-directory-area-2026-09

## Metadata
- Task ID: room-directory-area-2026-09 · Created: 2026-09-04 · Repo root: D:\www\Wesetup.ru
- Plan: фаза 2a плана room-responsibles; design doc: docs/superpowers/specs/2026-09-04-room-responsibles-and-directory-design.md

## Original task statement
Все журналы с помещениями используют общий справочник Room. Гигиена Room↔Area: переименование/удаление Room доходит до зеркальной Area; климат и график ген. уборок сидируются из Room, а не Area.

## Acceptance criteria
- AC1: PATCH /api/settings/rooms/[id] с новым name переименовывает Area с прежним именем в организации (best-effort).
- AC2: DELETE /api/settings/rooms/[id] удаляет зеркальную Area, если к ней не привязано оборудование и записи; иначе оставляет.
- AC3: POST /api/journal-documents для climate_control и general_cleaning сидирует строки из Room (`directoryRooms`), `allAreas` остаётся только для glass_items_list; `journal-default-configs` и `fetchOrgDataForDefaults` отдают `rooms`.
- AC4: typecheck/lint/tests зелёные.
