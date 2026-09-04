# Evidence — room-directory-area-2026-09 (2026-09-04)

| Проверка | Результат |
|---|---|
| `npm run typecheck` | PASS |
| `npx eslint` по затронутым файлам | PASS (0 errors; унаследованные warnings) |
| `npm test` | PASS (532/532) |

- AC1/AC2 — PASS (код): `src/app/api/settings/rooms/[id]/route.ts` — `previous.name` → `db.area.updateMany`; DELETE → `_count.equipment/journalEntries === 0` → `deleteMany`.
- AC3 — PASS (код): `src/app/api/journal-documents/route.ts` (`directoryRooms`, `buildClimateConfigFromRooms`, `buildSanitationDayConfigFromRooms`), `src/lib/journal-default-configs.ts`, `src/lib/journal-responsibles-cascade.ts`.
- AC4 — PASS.
