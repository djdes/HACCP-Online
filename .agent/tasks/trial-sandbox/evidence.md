# Sandbox / 14-day trial — evidence

Дата проверки: 2026-09-03. Спецификация: `spec.md` в этой папке.

## Команды

| Команда | Результат |
|---|---|
| `npx tsc --noEmit --skipLibCheck \| grep '^src/'` | 0 ошибок в `src/` |
| `npm test` | tests 435, pass 435, fail 0 (в т.ч. 12 новых в `src/lib/trial.test.ts`) |
| `npx eslint <изменённые и новые .ts/.tsx>` | 0 ошибок; 6 предупреждений `no-unused-vars` в строках, не тронутых задачей (`dashboard/page.tsx`, `mini/home/route.ts`) |
| `npm run build` | EXIT 0 — см. `raw/build-tail.txt` |

## Критерии приёмки

- **AC1 — PASS.** `getTrialStatus` покрыт `src/lib/trial.test.ts`: trial с `subscriptionEnd` в будущем (`phase: "trial"`, `daysLeft` вверх), fallback `createdAt + 14 д`, 15-й день → `"expired"` с `dayNumber 15`, продление ROOT'ом через `subscriptionEnd`, `free` → лимиты действуют, `paid`/`paused` → нет.
- **AC2 — PASS.** `decideTrialWrite` (тесты): 50-я запись проходит, 51-я → `allowed: false` при `testMode: false`; пачка 30 при 25 использованных не проходит; `paid` без лимита; в тестовом режиме — `allowed: true, softExceeded: true`. `trialWriteGate` отдаёт 402 `{ code: "trial_daily_limit", used, limit }` и стоит перед записью в: `POST /api/journals`, `PUT|PATCH /api/journal-documents/[id]/entries`, `entries/bulk`, `copy-yesterday`, `climate`, `cold-equipment`, `equipment-cleaning` (POST/PATCH), `fryer-oil` (POST/PATCH), `pest-control-entries` (POST/PATCH), `POST /api/mini/documents/[id]/entries`, `mini/journals/[code]/bulk-copy-yesterday`, `POST /api/task-fill/[taskId]`, `POST /api/equipment-fill/[equipmentId]`, `POST /api/dashboard/catch-up`, `POST /api/external/entries`; действия AI-помощника — `consumeTrialWrite` в `executeFillCells`. Счётчик — `Organization.trialWritesDayKey/trialWritesCount` (день по таймзоне организации), растёт только на ручных записях.
- **AC3 — PASS.** `trialSensorGate` в `POST /api/equipment` (при `tuyaDeviceId`) и `PUT /api/equipment/[id]` (при новой привязке, своё оборудование исключено из подсчёта): ≥ 3 привязанных на бесплатном тарифе и `BILLING_TEST_MODE=0` → 402 `trial_sensor_limit`.
- **AC4 — PASS.** `src/components/dashboard/trial-status-card.tsx` (дни / «последний день» / «закончился» / «бесплатный тариф», три счётчика с прогресс-барами, CTA `/settings/subscription`, пометка про тестовый режим) рендерится на `/dashboard` при `getTrialUsage() !== null`; `src/components/dashboard/trial-expired-modal.tsx` — при `phase === "expired"`: «Оформить подписку», «Остаться на бесплатном», «Напомнить позже» (sessionStorage).
- **AC5 — PASS.** `POST /api/settings/subscription/trial-decision` `{ decision: "reduce" }` → `reduceTrialToFreePlan`: `subscriptionPlan: "free"` на организации и аккаунте, аудит `plan.trial_reduced`; после `router.refresh()` фаза `free` — модалка не рендерится, карточка с CTA остаётся.
- **AC6 — PASS.** `GET /api/mini/home` (manager) возвращает `trial: { phase, daysLeft, endsAt } | null`; `src/app/mini/page.tsx` показывает строку в «Сводке смены» (`trialLine`).
- **AC7 — PASS.** `TRIAL_DAYS` из `src/lib/trial.ts` используется в `register/confirm` и `instant-register`; локальная константа удалена.
- **AC8 — PASS.** Проверки выше; задача 3.1.4 удалена из `docs/FEATURES_AND_AUTOMATION.md` (вместе с опустевшим разделом 3.1), строка добавлена в «Recently shipped»; `whats-new-notes.ts` — категория «Тестовый период» (иконка `Hourglass` в `whats-new-modal.tsx`), `LATEST_NOTES_BUILD_SHA` обновляется отдельным коммитом на SHA коммита фичи.

## Ограничения и решения

- В `BILLING_TEST_MODE` (по умолчанию включён) лимиты считаются и показываются, но не блокируют — та же политика, что у лимита сотрудников. Блокировка включается `BILLING_TEST_MODE=0`.
- Гейта нет у кронов автозаполнения, IoT-pull, `close-day` («не требуется») и конфигурационных эндпоинтов документа.
- Схема: `prisma db push` на деплое добавит `trialWritesDayKey`, `trialWritesCount` (nullable / default 0 — без миграции данных).
