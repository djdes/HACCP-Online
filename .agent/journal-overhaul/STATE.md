# Journal Overhaul State

## Last updated: 2026-04-28 — после iteration 8 (все 10 приоритетных журналов покрыты)

## Done

### Foundation (commits e0334f5, 3d91698)
- `JournalTaskClaim` Prisma model — атомарная race-resolution через unique constraint.
- `src/lib/journal-task-claims.ts` — claim/release/complete/getActive helpers.
- `src/lib/journal-task-pool.ts` — `generatePoolForDay(orgId, code, date)` per-journal scope generator.
- `src/lib/journal-completion-validators.ts` — per-journal валидация + side-effects (CAPA / Telegram).
- API:
  - `POST /api/journal-task-claims` — claim.
  - `POST /api/journal-task-claims/[id]` — release / complete (с form-payload validator).
  - `DELETE /api/journal-task-claims/[id]` — release alias.
  - `GET /api/journal-task-claims/my` — мой active.
  - `GET /api/journal-task-claims?journalCode&date` — claims за день.
  - `GET /api/journal-task-pool/[code]?date` — pool + claims одним вызовом.
  - `GET /api/mini/today` — все pool-задачи всех журналов в одном.
  - `GET /api/dashboard/live-claims` — кто что делает сейчас.
  - `GET /api/dashboard/med-books-expiry` — медкнижки.
  - `GET /api/dashboard/staff-training-overdue` — обучение.
- Cron `/api/cron/journal-claim-expire` — auto-expire >4h.
- Side-effects: создание CAPA + Telegram alert на out-of-range.
- Универсальный mini-app `/mini/today` aggregated view.
- Универсальная mini-app `/mini/claim/[id]` quick-form страница для completion после claim'а.
- Dashboard live-claims widget с 15-сек polling.
- Med-books expiry + Staff training overdue widgets на дашборде.

### Per-journal complete (через foundation):

#### `cleaning` (commit 0e9f3c6 baseline + foundation extension)
- TasksFlow-mediated race-claim рабочий через cleaningAdapter (existing).
- Foundation pool-generator поддерживает rooms-mode (selectedRoomIds → scope per room).
- `applyRoomsModeCompletion` race-resolution в TF inbound — рабочий.
- ✅ DONE.

#### `hygiene` / `health_check` (commit 3d91698, ed42b6b)
- scopeKey: `hygiene-shift:<documentId>:<YYYY-MM-DD>` — один scope «осмотр смены».
- Validator: temp > 37°C сотрудника → Telegram alert «не допущен».
- Mini-app form: allHealthy + notes (упрощённая — детальная остаётся в матрице).
- ✅ DONE.

#### `cold_equipment_control` (commit 3d91698, ed42b6b, 828636b)
- scopeKey: `fridge:<equipmentId>:<shift>:<YYYY-MM-DD>`, shift=morning|evening.
- Validator: temp вне Equipment.tempMin..tempMax (default -30..12) → требует corrective; auto-CAPA high + Telegram.
- Form: temperature + correctiveAction.
- ✅ DONE.

#### `climate_control` (commit 3d91698, ed42b6b, 828636b)
- scopeKey: `area:<areaId>:<shift>:<YYYY-MM-DD>`.
- Validator: temp вне +5..+32°C, humidity вне 30-75% — warning.
- Form: temperature + humidity.
- ✅ DONE.

#### `incoming_control` (commit 3d91698, ed42b6b, 828636b)
- scopeKey: `incoming:<orgId>:<YYYY-MM-DD>` (один pool на день).
- Validator: rejection без причины → блок completion.
- Form: supplier/productName/expirationDate/temp/qty/accepted/rejectionReason.
- allowNoEvents: YES.
- ✅ DONE.

#### `finished_product` (commit 3d91698, ed42b6b, 828636b)
- scopeKey: `meal:<breakfast|lunch|dinner>:<YYYY-MM-DD>`.
- Validator: tasteOk=false → CAPA high.
- Form: dish/appearance/taste/temp/correctiveAction.
- ✅ DONE.

#### `disinfectant_usage` (commit 3d91698, 828636b)
- scopeKey: `disinf:<orgId>:<YYYY-MM-DD>`.
- Form: name/concentration/volume/purpose.
- ✅ DONE.

#### `fryer_oil` (commit 3d91698, ed42b6b, 828636b)
- scopeKey: `fryer:<equipmentId>:<YYYY-MM-DD>` (per fryer) или `fryer:default:<date>` если fryers нет в каталоге.
- Validator: polar > 25% без replaced=true → блок; на replaced=true → CAPA medium.
- Form: temperatureC/polar/colorAcceptable/replaced.
- ✅ DONE.

#### `med_books` (commit 25bcb24)
- НЕ pool-журнал. Реализован дашборд-виджет.
- Источник: `StaffCompetency` со skill='med_book'.
- 5 статусов: expired / warning (<30 дн) / missing / no_expiry / ok.
- Click → /competencies?user=<id>.
- ✅ DONE.

#### `staff_training` (commit 973c178)
- НЕ pool-журнал в WeSetup-side mini-app — это event-driven.
- Реализован дашборд-виджет «Гигиеническое обучение».
- Источник: `JournalDocumentEntry` журнала staff_training за последний год.
- Per-user статус: overdue (>365 дн) / warning (<30 дн до 365) / missing / ok.
- ✅ DONE.

#### `accident_journal` / `complaint_register` (commit 3d91698, 828636b)
- scopeKey: `<code>:<orgId>:<YYYY-MM-DD>` (один pool на день).
- Form: description/severity/actionTaken (для accident); complaintText/source/actionTaken (для complaint).
- ✅ DONE (бонус, поверх 10).

## In progress
- (пусто)

## Next (если будет ещё работа)
1. Cleaning native mini-app форма (сейчас через TF Telegram).
2. Anomaly detection расширения per-journal.
3. PDF export для inspector mode за период.
4. Mini home link на `/today` в навигации.
5. Equipment.tempMin/tempMax UI редактор.

## Blockers
- (none)

## Notes / edge cases
- `applyRoomsModeCompletion` race-resolution в cleaning — based on `JournalDocumentEntry` upsert. Foundation `JournalTaskClaim` — отдельный механизм для PRE-completion claim (новый flow). Оба сосуществуют.
- shadcn dark theme через `@custom-variant dark` теперь работает с `[data-app-theme="dark"]` — все новые виджеты совместимы.
- Если у org нет equipment c tempMin/tempMax — validator берёт default -30..12°C для холодильников.
- `allowNoEvents` defaults уже выставлены в JournalTemplate.allowNoEvents (default=true) — приёмка/бракераж/жир ОК; гигиена/холодильники/климат должны быть NO (требуется ручной toggle в /settings/journals/<code>/scope).

## Changelog
- 2026-04-28 — создан PROMPT.md и STATE.md.
- 2026-04-28 (e0334f5) — JournalTaskClaim foundation: model + helpers + API + cron.
- 2026-04-28 (3d91698) — pool generator + UI primitives для всех 10 журналов.
- 2026-04-28 (2862f82) — dashboard live-claims widget.
- 2026-04-28 (3a6390f) — mini-app `/today` aggregated view.
- 2026-04-28 (ed42b6b) — per-journal completion validators + auto-CAPA + Telegram.
- 2026-04-28 (828636b) — `/mini/claim/[id]` универсальная быстрая форма.
- 2026-04-28 (25bcb24) — med-books expiry widget.
- 2026-04-28 (973c178) — staff-training overdue widget.

✅ ВСЕ 10 ПРИОРИТЕТНЫХ ЖУРНАЛОВ ЗАКРЫТЫ.
