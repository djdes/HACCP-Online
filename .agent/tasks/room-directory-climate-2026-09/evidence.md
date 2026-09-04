# Evidence — room-directory-climate-2026-09 (2026-09-04)

| Проверка | Результат |
|---|---|
| `npm run typecheck` | PASS |
| `npx eslint` по затронутым файлам | PASS (0 errors; унаследованные warnings) |
| `npm test` | PASS (532/532), в т.ч. `src/lib/room-directory.test.ts` |
| `npx prisma db push` (локально) | PASS — `Room.climateNorms` |

- AC1 — PASS: `prisma/schema.prisma`, `src/app/api/settings/rooms/[id]/route.ts` (`ClimateMetricSchema`, `climateNorms`).
- AC2 — PASS: `src/lib/climate-document.ts` (+ тесты `room-directory.test.ts`).
- AC3/AC4 — PASS (код): `climate-document-client.tsx`, `room-directory-picker-dialog.tsx`, `room-editor-dialog.tsx`, `room-editor-initial.ts`, `page.tsx` (loadDirectoryBuildings).
- AC5 — PASS (код): `src/lib/external/dispatch.ts`, `src/lib/journal-task-pool.ts`, `src/lib/tasksflow-adapters/climate.ts`, `src/lib/document-pdf.ts`.
- AC6 — PASS: скрипт написан; на проде не запускался (запуск после деплоя вручную).

Не проверено вручную в браузере (только typecheck/lint/тесты).
