# Journal Overhaul State

## Last updated: 2026-04-28 — после iteration 1 (foundation)

## Done

### `cleaning` (REFERENCE) — partial
- ✅ Существующая race-resolution через `applyRoomsModeCompletion` (post-completion race по roomId+date) — рабочая, не трогаю.
- ✅ TasksFlow outbound mirror через `cleaningAdapter` в `src/lib/tasksflow-adapters/cleaning.ts` — рабочий.
- ✅ TasksFlow inbound через `/api/integrations/tasksflow/complete` — рабочий.
- ✅ `parseRoomsModeRowKey` + `parseControlRowKey` парсеры — рабочие.
- ⚠️ Что НЕ доделано: WeSetup-side native mini-app для cleaning не имеет race-claim UI ("Взять" кнопок). Сейчас flow целиком через TasksFlow Telegram. Это ОК для демо если показывать TasksFlow, но для будущего нужен и native UI.
- 🟢 На демо cleaning через TasksFlow работает as-is.

### Foundation (commit `e0334f5`) — ✅ DONE
Универсальная race-claim инфраструктура для ВСЕХ будущих журналов:
- `JournalTaskClaim` Prisma model с атомарной race-resolution.
- `src/lib/journal-task-claims.ts` — helpers: `claimJournalTask`, `releaseJournalTask`, `completeJournalTask`, `getActiveClaimForUser`, `listClaimsForJournal`, `expireStaleClaims`.
- API:
  - `POST /api/journal-task-claims` — claim (200 / 409 taken_by_other / 409 user_has_active / 409 scope_completed).
  - `GET  /api/journal-task-claims?journalCode&date=` — все claims за день.
  - `GET  /api/journal-task-claims/my` — мой active claim.
  - `POST /api/journal-task-claims/[id]` body { action: release|complete } — управление.
  - `DELETE /api/journal-task-claims/[id]` — release alias.
- Cron `/api/cron/journal-claim-expire?secret=` — auto-expire > 4h.

scopeKey конвенция (использовать для всех будущих журналов):
- `cleaning`: `room:<roomId>:<YYYY-MM-DD>`
- `cold_equipment_control`: `fridge:<equipmentId>:<shift>:<YYYY-MM-DD>` (shift = `morning|evening`)
- `climate_control`: `area:<areaId>:<shift>:<YYYY-MM-DD>`
- `incoming_control`: `delivery:<deliveryEventId>:<YYYY-MM-DD>` или для daily-pool `incoming:<orgId>:<YYYY-MM-DD>` если без явных событий
- `finished_product`: `meal:<mealName>:<YYYY-MM-DD>` — где mealName = breakfast|lunch|dinner
- `disinfectant_usage`: per-event, нет smysla pool — каждый event новый scope, race не нужен
- `fryer_oil`: `fryer:<equipmentId>:<YYYY-MM-DD>`
- `med_books`: master-data, не race-claim
- `staff_training`: per-event, claim нужен только если несколько менеджеров

## In progress
- (пусто) — следующий прогон: `hygiene`.

## Next (priority order)
1. `hygiene` — ⏭️ NEXT.
   - Ответственный (head_chef/manager) проводит ежедневный осмотр смены.
   - Существующий код: `src/components/journals/hygiene-document-client.tsx` (matrix), `src/lib/hygiene-document.ts`.
   - **Задача в этой итерации:** добавить race-claim для «Гигиенический осмотр смены» (scopeKey: `hygiene-shift:<documentId>:<YYYY-MM-DD>`). Mini-app: показать карточку «Сегодняшний осмотр» с кнопкой «Взять и провести». После claim → переход на форму osмотра. Завершение → JournalDocumentEntry[] для всех сотрудников + complete claim.
   - allowNoEvents: NO.
   - Anomaly: temperature > 37 → CAPA + Telegram notification.

2. `cold_equipment_control`
   - Holdильники × смены = pool tasks.
   - scopeKey: `fridge:<equipmentId>:<shift>:<YYYY-MM-DD>`.
   - Mini-app: список карточек холодильников, status «Доступно/Взято/Готово».
   - Form: temperature, humidity?, photo, correctiveAction (если out-of-range).
   - Anomaly: temp вне tempMin..tempMax → требовать correctiveAction + auto-CAPA + Telegram.

3. `climate_control`
4. `incoming_control`
5. `finished_product`
6. `disinfectant_usage`
7. `fryer_oil`
8. `med_books`
9. `staff_training`
10. (далее по `JournalCatalog.sortOrder`)

## Blockers
- (none)

## Notes / edge cases (накапливается)
- `applyRoomsModeCompletion` race-resolution в cleaning — based on `JournalDocumentEntry` upsert по `(documentId, employeeId, date)` unique. Для RACE-CLAIM (pre-completion) нужна отдельная модель — это что я добавил в JournalTaskClaim. Не путать оба.
- `JournalObligation` существующая модель — per-user (один-к-одному с пользователем), не подходит для pool-claim. Используется для премиальных bonus-журналов — оставляю как есть.
- Шаблон scopeKey всегда включает date-component — иначе на следующий день active-claim останется и заблокирует pool.
- One-active-task rule НЕ блокирует ROOT (кода нет, но добавим bypassActiveCheck для admin-override flow если потребуется).
- shadcn Button outline с `dark:bg-input/30` — после фикса @custom-variant работает в dark теме. NEW components могут смело использовать shadcn variants.

## Changelog
- 2026-04-28 — создан PROMPT.md и STATE.md, очередь сформирована.
- 2026-04-28 (iteration 1, commit e0334f5) — JournalTaskClaim foundation: model + helpers + API + cron. cleaning отмечен как partial-done (TasksFlow-mediated работает).
- → next: hygiene.
