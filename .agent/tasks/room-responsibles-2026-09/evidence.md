# Evidence — уборщики и проверяющие у помещения (фаза 1)

Дата: 2026-09-04 · локальная БД PGlite 5433 (`prisma db push` применён)

## Проверки

| Проверка | Результат |
|---|---|
| `npm run typecheck` | PASS |
| `npx eslint` по затронутым файлам | PASS (0 errors; 27 унаследованных warnings `no-unused-vars` в cleaning-document-client / document-pdf / adapters/cleaning) |
| `npm test` | PASS (524/524; до правок 519 тестов) |
| `npx prisma db push` (локально) | PASS — `Room.cleanerUserIds`, `Room.verifierUserIds` |

## Критерии приёмки

### AC1 — PASS (тесты `src/lib/cleaning-room-responsibles.test.ts`)
- DB-уборщики заменяют закрепление; пул raw → новые; комнаты без DB — legacy/пул; unknown id отброшены; вне selectedRoomIds — игнор; вход не мутируется; пустой пул + DB → непустой эффективный.

### AC2 — PASS (тесты там же + `cleaning-zone-responsibles.test.ts`)
- `verifierByRoomId` string[] с коэрцией legacy string; `resolveRoomControllers` / `resolveRoomController`.

### AC3 — PASS (код)
- `room-editor-dialog.tsx`: карточки «Кто убирает» / «Кто проверяет (необязательно)» с `MultiUserPicker`; группировка — `room-responsible-candidates.ts` (тесты).
- `api/settings/rooms/[id]/route.ts`: zod `cleanerUserIds`/`verifierUserIds` (max 30), дедуп, `ensureOrgUsers` → 400 для чужих/архивных.

### AC4 — PASS (код)
- `cleaning-document-client.tsx`: `roomAssignmentLabel` по `effectiveConfig`, `roomVerifierLabel`; десктоп и мобильные карточки; клик → `openRoomEditorFromRow`.

### AC5 — PASS (код + тесты)
- `tasksflow-adapters/cleaning.ts`, `cleaning-cell-override-sync.ts`, `document-pdf.ts`, `api/journal-documents/[id]/route.ts` — `applyRoomResponsiblesToConfig` после нормализации; валидация на эффективном конфиге.

### AC6 — PASS (код)
- `buildings-client.tsx` `addRoom`: после 201 → `onEditRoom(created.room)`.

### AC7 — PASS (код)
- `buildings-client.tsx`: чипы «Убирает: …» / «Проверяет: …» / «Уборщики не назначены».

### AC8 — PASS (код)
- `CLEANING_ROW_LABELS` в `cleaning-document.ts`; использован в клиенте журнала, карточках списка, PDF. Хранимые `title` и сравнения не тронуты.

### AC9 — PASS (код + тесты `tasksflow-adapters/cleaning-control-rowkey.test.ts`)
- Cron `cleaning-control-digest`: карта проверяющий → помещения, rowKey legacy для контролёра документа, суффикс для своих; идемпотентность по rowKey.
- Webhook: `controllerScopeRoomIds` → `applyControlCompletion({ roomIds })`.

### AC10 — PASS
- `whats-new-notes.ts`: категория «Помещения и уборка» (иконка добавлена в `CATEGORY_ICONS`); SHA — отдельным коммитом после основного.

## Не проверено вручную в браузере
- Визуальный прогон карточки помещения и журнала — только typecheck/lint/тесты (см. раздел «Ручная проверка» в плане).
