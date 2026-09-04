# Evidence — 2026-09-04

| AC | Статус | Как проверено |
|---|---|---|
| AC1 | PASS | `cleaning-zone-responsibles.test.ts`: merge двух зон, legacy-запись, upgrade legacy → rooms |
| AC2 | PASS | тесты resolveRoomCleaners (RR, race, закрепление, вне пула, пустой пул), normalizeCleanerByRoomId, normalizeCleaningDocumentConfig |
| AC3 | PASS | `buildRoomsModeRows` и `pickCleanersForRoom`/`pickVerifierWesetupId` вызывают резолвер; собственной RR-логики нет (grep `% cleaners.length` → только cleaning-document.ts) |
| AC4 | PASS (код) | `RoomsModeCard`: блок «Закрепить зоны», чипы пула, итог «Зон на уборщика»; строки комнат: `roomAssignmentLabel`; полоска: «Закреплено зон». Браузерная проверка не выполнена: локальная БД = прод, нет учётки |
| AC5 | PASS | `document-pdf.ts`: `listCleaningCodeEntries` + `resolveRoomCleaners` → «Помещение (С2)»; `listCleaningRoomCompletions` в ячейках |
| AC6 | PASS | `cleaning-control-digest`: `resolveDocumentController` (controlUserId ?? controlResponsibles[0]) |
| AC7 | PASS | `hasExplicitPerRowDistribution` + guard в bulk-assign-today; тест |
| AC8 | PASS | `npm test`: 471 pass / 0 fail; `tsc --noEmit`: чисто; eslint по изменённым файлам: 0 errors; whats-new-notes обновлён |

Не сделано (вне spec): Фаза 2 (контролёр по зонам: UI, дайджест per-контролёр, verify-scoping).
