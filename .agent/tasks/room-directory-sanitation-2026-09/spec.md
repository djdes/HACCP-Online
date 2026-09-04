# Task Spec: room-directory-sanitation-2026-09

## Metadata
- Task ID: room-directory-sanitation-2026-09 · Created: 2026-09-04 · Repo root: D:\www\Wesetup.ru
- Plan: фаза 2c; design doc: docs/superpowers/specs/2026-09-04-room-responsibles-and-directory-design.md

## Original task statement
График ген. уборок использует общий справочник помещений: строки связаны с Room, карточка помещения открывается из журнала, ответственные и состав уборки — из карточки.

## Acceptance criteria
- AC1: `SanitationRoomRow.roomId`; `normalizeRows` сохраняет; `buildSanitationDayConfigFromRooms` (id `row-room-<Room.id>`); `applyRoomDirectoryToSanitationConfig` — название из Room. Тесты.
- AC2: Новый документ сидируется из Room (сервер), клиент создания больше не шлёт демо-строку.
- AC3: В журнале «Добавить помещение» — пикер + «Создать новое»; клик по помещению/«Редактировать» у связанной строки — `RoomEditorDialog` (focus="cleaning"); legacy — legacy-диалог с «Связать»; под названием — «Убирает / Проверяет» (таблица и мобильные карточки).
- AC4: TF-адаптер: ответственный строки = первый уборщик помещения (fallback — ответственный документа), verifier = первый проверяющий, requiresPhoto из Room, monthDay из `generalMonthDays`, шаги формы из `Room.generalScope` (fallback — стандартные 8).
- AC5: PDF печатает эффективные названия. typecheck/lint/tests зелёные.
