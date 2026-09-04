# Task Spec: room-directory-climate-2026-09

## Metadata
- Task ID: room-directory-climate-2026-09 · Created: 2026-09-04 · Repo root: D:\www\Wesetup.ru
- Plan: фаза 2b; design doc: docs/superpowers/specs/2026-09-04-room-responsibles-and-directory-design.md

## Original task statement
Журнал климата использует общий справочник помещений: нормы температуры/влажности — в карточке помещения (`Room.climateNorms`), строки документа связаны с Room (`roomId`), быстрая настройка помещения из журнала.

## Acceptance criteria
- AC1: `Room.climateNorms Json?`; PATCH rooms принимает `climateNorms` (zod: min ≤ max, хотя бы одна метрика включена; null = выключено).
- AC2: `ClimateRoomConfig.roomId`; `buildClimateConfigFromRooms` (id `room-<Room.id>`); нормализатор сохраняет roomId; `applyRoomDirectoryToClimateConfig` — Room wins по имени/нормам, ключи строк не меняются; строки без связи/с удалённым помещением остаются. Тесты.
- AC3: В журнале «Добавить помещение» — пикер из справочника + «Создать новое» (сразу карточка); карандаш у связанной строки открывает `RoomEditorDialog` (focus="climate"); legacy-строки — «Связать» (по совпадению имени или в legacy-диалоге), нормы строки переносятся в Room, если там пусто.
- AC4: `RoomEditorDialog` — секция «Климат» и prop `focus`.
- AC5: Датчики (external/dispatch): `reading.roomId` = id строки или Room.id; имя — эффективное; task-pool климата — по Room; TF-адаптер (listDocuments/getTaskForm) и PDF — по эффективному конфигу.
- AC6: Скрипт `scripts/migrate-journal-rooms-to-directory.ts` (dry-run/--apply/--create). typecheck/lint/tests зелёные.
