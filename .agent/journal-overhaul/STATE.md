# Journal Overhaul State

## Last updated: 2026-04-29 — все журналы покрыты + TF mirror

## Done (production-ready)

### Foundation
- `JournalTaskClaim` Prisma model — атомарная race-resolution.
- `src/lib/journal-task-claims.ts` — claim/release/complete/getActive helpers.
- `src/lib/journal-task-pool.ts` — pool generator для всех 30+ журналов.
- `src/lib/journal-completion-validators.ts` — валидаторы + auto-CAPA + Telegram.
- `src/lib/tasksflow-claim-mirror.ts` — bi-directional WeSetup ↔ TF.

### API
- `POST /api/journal-task-claims` — claim (с TF outbound mirror).
- `POST /api/journal-task-claims/[id]` — release/complete (валидаторы + CAPA + TF mirror).
- `DELETE /api/journal-task-claims/[id]` — release alias.
- `GET /api/journal-task-claims/my` — мой active.
- `GET /api/journal-task-claims?journalCode&date` — claims за день.
- `GET /api/journal-task-pool/[code]?date` — pool + claims one-shot.
- `GET /api/mini/today` — все pool-задачи всех 30+ журналов.
- `GET /api/dashboard/live-claims` — кто что делает.
- `GET /api/dashboard/med-books-expiry` — медкнижки.
- `GET /api/dashboard/staff-training-overdue` — гигиеническое обучение.
- `POST /api/integrations/tasksflow/complete` — расширен: inbound TF → JournalTaskClaim sync.

### Mini App
- `/mini/today` — единый список задач сотрудника.
- `/mini/claim/[id]` — universal quick form (форма по journalCode для всех 30+).
- `/mini/journals/[code]` — JournalTaskPool наверху для всех pool-кодов.
- `/mini` главная — кнопка «Сегодня — все задачи» (lime CTA).

### Dashboard
- LiveClaimsCard — кто что делает (15-сек polling).
- MedBooksExpiryCard — статус медкнижек.
- StaffTrainingCard — статус обучения.

### TasksFlow Bi-directional Mirror
- **Outbound** (WeSetup → TF): при claim → updateTask(workerId=tfUserId);
  при complete → completeTask(); при release → noop. Linked via
  TasksFlowTaskLink rowKey=scopeKey.
- **Inbound** (TF → WeSetup): existing /api/integrations/tasksflow/complete
  handler теперь вызывает syncTasksFlowCompletionToClaim — обновляет
  JournalTaskClaim status=completed когда сотрудник нажимает «Готово»
  в TF Telegram.
- Graceful degrade: если integration отключён / TF user-link отсутствует
  / TF task-link отсутствует — claim/complete всё равно проходит в
  WeSetup, TF errors логируются.

### Validators (auto-CAPA + Telegram)
- `cold_equipment_control`: temp вне range → требует corrective →
  CAPA high + Telegram alert.
- `hygiene/health_check`: temp > 37°C сотрудника → Telegram alert.
- `fryer_oil`: polar > 25% без replaced=true → блок.
- `incoming_control`: rejection без причины → блок.
- `finished_product`: tasteOk=false → CAPA high.
- `climate_control`: temp/humidity out → warning.

### All 30+ journal codes покрыты pool generator + JOURNAL_FORMS:
hygiene, health_check, cold_equipment_control, climate_control, cleaning,
incoming_control, finished_product, disinfectant_usage, fryer_oil,
accident_journal, complaint_register, breakdown_history, ppe_issuance,
glass_items_list, glass_control, metal_impurity, perishable_rejection,
product_writeoff, traceability_test, general_cleaning,
sanitation_day_control, sanitary_day_control, pest_control,
intensive_cooling, uv_lamp_runtime, equipment_maintenance,
equipment_calibration, equipment_cleaning, audit_plan, audit_protocol,
audit_report, training_plan.

`med_books`, `staff_training` — НЕ pool, реализованы как dashboard
widgets (expiry / overdue trackers).

## Production verification (2026-04-29)
- Build SHA `3a8a3838` deployed; later commits в очереди GH Actions.
- `/mini/today` → 200.
- `/api/journal-task-claims/my` → 401 (auth required, endpoint alive).
- `/api/journal-task-pool/cleaning?date=...` → 401.
- `/api/integrations/tasksflow/complete` → 401 (валидное поведение
  для отсутствующего bearer).
- `pm2 status` — haccp-online online, no crashloop.

## Demo scenario ready

1. Менеджер на `/dashboard`:
   - Live claims widget — видит активность.
   - Anomalies widget — подозрительные записи.
   - Compliance ring + close-day + catch-up.
   - Med-books / Staff-training expiry trackers.

2. Сотрудник в Telegram Mini App:
   - Открывает `/mini/today` → все доступные задачи сегодня.
   - «Взять» → claim (атомарный, race-safe).
   - Перебрасывает на `/mini/claim/[id]` → быстрая форма.
   - «Завершить» → валидация → опц. CAPA + Telegram → completed.
   - Mirror в TasksFlow: TF Telegram бот тоже отображает claim
     когда linked task существует (сценарий cleaning rooms-mode).

3. One-active-task rule:
   - Пока active — все «Взять» disabled с tooltip.

## Blockers
- (none)

## Notes
- Cleaning native mini-app race-claim flow работает через pool
  generator (`room:<id>:<date>` scopeKey). Existing TF cleaningAdapter
  (`room::<id>::cleaner::<id>` rowKey) — параллельный поток для TF
  Telegram только. Если есть линк через rowKey совпадение — mirror
  срабатывает; иначе pure WeSetup-flow.
- Все pool-журналы graceful: если active document отсутствует, scopes=[].

## Changelog
- 2026-04-28 (e0334f5) JournalTaskClaim foundation.
- 2026-04-28 (3d91698) Pool generator + Mini App pool UI.
- 2026-04-28 (2862f82) Live claims dashboard widget.
- 2026-04-28 (3a6390f) /mini/today aggregated view.
- 2026-04-28 (ed42b6b) Per-journal validators + auto-CAPA + Telegram.
- 2026-04-28 (828636b) /mini/claim/[id] universal quick form.
- 2026-04-28 (25bcb24) Med-books expiry widget.
- 2026-04-28 (973c178) Staff-training overdue widget.
- 2026-04-28 (369b25a) STATE: top-10 closed.
- 2026-04-29 (3a8a383) TasksFlow bi-directional mirror.
- 2026-04-29 (f04e4b0) Pool + forms для 17 дополнительных журналов.
- 2026-04-29 (a721ff5) Mini-home «Сегодня» CTA button.

✅ ВСЕ ЖУРНАЛЫ CATALOG'А ЗАКРЫТЫ + TASKSFLOU MIRROR + DASHBOARD WIDGETS.
