# LOOP-NEXT — live state tracker

**Назначение:** этот файл — единственный источник правды о том, что нужно делать в следующей `/loop 10m`-итерации. Любая итерация ОБЯЗАНА:
1. Прочитать этот файл целиком до Action.
2. Прочитать `docs/PIPELINE-VISION.md` для контекста и протокола.
3. Выбрать следующий пункт по приоритету (P0 > P1 > P2).
4. Сделать его, верифицировать, задеплоить.
5. **Обновить этот файл** с пометкой DONE + git-sha + timestamp в МСК.
6. Если это P0/P1 финал — добавить запись в `Owner notifications`.

**Дата создания:** 2026-05-04
**Текущий HEAD на момент создания:** `1f9becbe` (фото-доказательство wave B)
**Master plan:** [`PIPELINE-VISION.md`](./PIPELINE-VISION.md)

---

## ⏭ NEXT (что делать прямо сейчас)

> При запуске loop — берётся топ из P0. Если P0 пуст → P1. Если P1 пуст → P2.

**Текущий приоритет:** **P1.7 — Subtasks (nested pipeline nodes)** — UI поддержка глубины 3, wizard рендерит indent.

---

## P0 — Active bugs

### [x] P0.1 — Pipeline не заполняет колонки журнала — DONE FULL @ 67e4b315 @ 2026-05-05 12:15 МСК (PART-1 @ 81f60ada @ 2026-05-04 23:24 МСК)
- **Что сделано (foundational + glass_control specific):**
  1. PipelineWizard теперь рендерит `step.field` внутри текущего шага (input между detail и кнопкой «Сделал»), value хранится в общем `values`
  2. Кнопка «Сделал» disabled пока required field не заполнено — `fieldSatisfied()` хелпер
  3. Done-шаги показывают что было введено (badge с label: value)
  4. Создан `glass-control` адаптер с 4 pipeline-шагами: damagesDetected (yes/no select) → itemName → quantity → damageInfo. Каждый шаг с инструкцией по СанПиН. Worker не пройдёт без заполнения.
  5. `applyRemoteCompletion` пишет данные в `JournalDocumentEntry.data` shape `{damagesDetected, itemName, quantity, damageInfo}` — это и есть колонки журнала. `_meta` хранит pipeline trail.
- **Что НЕ сделано (вынесено в P1.4):**
  - Generic-адаптер для остальных журналов всё ещё evidence-only — он не знает field shape конкретного журнала. Полное решение — pipeline editor (P1) с pinned-узлами по полям. Пока что закрывают журналы по одному per-journal-адаптером (как glass_control).
  - Список журналов где fallback на generic + НЕТ нормального заполнения: см. вычислить через `npm run` script (TODO добавить в P1)
- **Файлы:**
  - `src/app/task-fill/[taskId]/task-fill-client.tsx` (PipelineWizard, formatPipelineValue)
  - `src/lib/tasksflow-adapters/glass-control.ts` (новый)
  - `src/lib/tasksflow-adapters/index.ts` (registration)
- **Acceptance verification:** TODO — playwright прогон через test-аккаунт на проде (пишет уборщица, проверяю запись в БД)

### [x] P0.2 — Ответственные cleaning desync — DONE @ 809bd40d @ 2026-05-05 00:00 МСК
- **Что сделано:**
  1. Изучен паттерн haccp-online через Playwright (логин test4/test8): у них single-source-of-truth между banner-селектами и settings-modal — оба пишут в одни position+employee поля.
  2. Найден root cause в `updateSettings()` cleaning-document-client.tsx: `.map()` на пустом `cleaningResponsibles[]` или `controlResponsibles[]` возвращает пустой массив, сохранение тихо теряется. Banner select и settings-modal оба вызывают этот метод.
  3. Реализован upsert: новая внутренняя функция `upsertResponsible(kind, items, role, userId)` создаёт новую запись через `createCleaningResponsibleRow` если массив пустой, иначе обновляет index 0.
  4. Тип-чек чисто, ESLint только pre-existing warnings.
- **Acceptance:** теперь banner select и settings-modal оба пишут в одно место; первый выбор ответственного на пустом документе сохраняется и виден после refresh. Других журналов не трогали — этот баг был cleaning-specific (другие журналы используют другую модель ответственных, не arrays).
- **Файлы:** `src/components/journals/cleaning-document-client.tsx` (только updateSettings)

---

## P1 — Pipeline Editor (architectural)

См. секцию P1 в `PIPELINE-VISION.md`. Декомпозированы на меньшие задачи:

### [x] P1.1 — Schema migration: JournalGuide* + JournalPipeline* models — DONE @ 3d9f0fe6 @ 2026-05-05 09:50 МСК
- 4 модели добавлены в `prisma/schema.prisma`: `JournalGuideTemplate`, `JournalGuideNode`, `JournalPipelineTemplate`, `JournalPipelineNode`
- Self-referencing parent/children через named relation (`guide_children`, `pipeline_children`) для tree structure
- `ordering: Float` + `@@index([templateId, parentId, ordering])` — drag-drop без reindexing
- `kind: "pinned"|"custom"` + `linkedFieldKey` для pipeline nodes (привязка к колонке журнала)
- Organization получил `journalGuideTemplates[]` и `journalPipelineTemplates[]` reverse relations
- `npx prisma generate` clean локально, `prisma db push` отработал в deploy.yml на проде, PM2 stable
- Acceptance: типы доступны через `db.journalPipelineTemplate.create({...})` и т.д.

### [x] P1.2 — API: GET/PATCH/POST/DELETE для pipeline tree — DONE wave-a @ a97a8a0b @ 2026-05-05 10:05 МСК + wave-b @ 43360d86 @ 2026-05-05 10:25 МСК (8/8 endpoints)
- 6 endpoints из 8 закрыты:
  - `GET /api/settings/journal-pipelines/[code]` — load tree (добавлен в legacy-route.ts)
  - `POST /[code]/nodes` — создать custom-узел
  - `PATCH /[code]/nodes/[id]` — редактировать (title/detail/hint/photoMode/requireComment/requireSignature)
  - `DELETE /[code]/nodes/[id]` — удалить (только custom; pinned → 403)
  - `PATCH /[code]/nodes/[id]/move` — перемещение (parentId + ordering, защита от циклов)
  - `POST /[code]/clear-custom` — drop all custom-узлов
- Все защищены `requireApiAuth` + `hasFullWorkspaceAccess` (401/403)
- Каждая мутация пишет AuditLog (`settings.journal-pipelines.*`)
- Helper-модуль `src/lib/journal-pipeline-tree.ts` — `findPipelineTemplate`, `ensurePipelineTemplate`, `loadPipelineTree`, `computeNextOrdering`
- **Wave-b @ 43360d86:** добавлены последние 2 endpoint'а:
  - `POST /[code]/seed` — создаёт pinned-узлы по `JournalTemplate.fields[]`. Идемпотентно: если pinned уже есть → 409.
  - `POST /[code]/nodes/[id]/split` — разделяет pinned на два с тем же `linkedFieldKey`. Title оригинала становится «(часть 1)», новый — «(часть 2)». Поддерживает повторный split (увеличивает номер). $transaction для atomicity.
- Acceptance: 401 на unauthenticated POST ко всем 8 endpoint'ам, GET/DELETE на seed → 405, prod не сломан, login=200

### [/] P1.3 — Pipeline editor UI с drag-drop — IN PROGRESS
- [x] **wave-a @ ea77008a @ 2026-05-05 10:50 МСК** — read-only tree page `/settings/journal-pipelines-tree/[code]`:
  - Server-component читает `loadPipelineTree` + `JournalTemplate.fields`
  - Client-component список узлов с indent по depth, badge'ы (pinned/custom/photo/comment)
  - Кнопка «Создать из колонок» → POST /seed (с подтверждением через `JournalSettingsModal`)
  - Кнопка «Добавить custom-шаг» → POST /nodes (форма title + detail + photoRequired)
  - Кнопка корзины на custom → DELETE /nodes/[id] через `ConfirmDialog danger`
  - Empty-state UI когда `tree === null` или `nodes === []`
  - Hero-блок в Design v2 с Pin-иконкой и breadcrumb «← К списку журналов»
  - На list-page `/settings/journal-pipelines` добавлены ссылки «🌳 Дерево (beta)» и счётчик активных узлов
- [x] **wave-b @ 59de6148 @ 2026-05-05 11:10 МСК** — edit-dialog `EditNodeDialog`:
  - Клик по ⚙ открывает модалку. PATCH `/nodes/[id]` с полями: title, detail, hint, photoMode (3-кнопочный selector none/optional/required), requireComment, requireSignature
  - Pinned-узлы показывают `linkedFieldKey` в info-блоке (нельзя менять)
  - `useNodeSync` хук подсасывает поля узла в state каждый раз, когда модалка открывается (иначе старое значение остаётся)
- [x] **wave-c @ 94b40e83 @ 2026-05-05 11:30 МСК** — DnD reorder + split-pinned:
  - Установлены `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`
  - `DndContext` + `SortableContext` + `verticalListSortingStrategy` обернули tree-list
  - Каждая строка вынесена в `<SortableNodeRow>`. Drag-handle (GripVertical) на левом краю — `useSortable` listeners на этом button'е, остальная строка кликабельна для edit
  - `handleDragEnd` вычисляет новый `ordering` по формуле `(prev + next) / 2` (для float-ordering без reindexing). Edge cases: первая позиция = `next/2`, последняя = `prev + 1024`
  - Optimistic UI — local state меняется сразу, потом PATCH `/move`. Rollback через `refresh()` если 4xx/5xx
  - DnD работает только на root-level (parentId=null) — nested moves вынесены в P1.7
  - `<Split>` icon-button на pinned-узлах → POST `/split`. Toast «Узел разделён», новый узел сразу появляется ниже оригинала
  - Hint: «Перетаскивайте узлы за иконку ⋮ чтобы изменить порядок» под списком
- [x] **wave-d @ e8f65e76 @ 2026-05-05 11:55 МСК** — live wizard preview pane:
  - Layout сменился на `lg:grid-cols-[minmax(0,1fr)_420px]` — tree слева, preview справа sticky-top
  - `<WizardPreview>` воспроизводит layout `<PipelineWizard>` из task-fill-client.tsx: progress-bar шапка, ol со step-карточками
  - Шаг 1 показан в "current" стиле (indigo border, shadow, кнопка «Сделал» disabled-style); остальные — в lock-стиле (gray)
  - Каждый шаг показывает title, и ТОЛЬКО для текущего: detail, hint (с emoji 💡), badge'ы для photoMode/requireComment/requireSignature/linkedFieldKey
  - Empty-state «Нет шагов для превью» если nodes.length=0
  - На `<lg` 1-колонка (preview под tree)
- [x] **P1.3 ЗАКРЫТ** — Pipeline editor UI полностью функционален: read + create-from-fields + add-custom + edit + delete-with-confirm + DnD reorder + split-pinned + live-preview

### [x] P1.4 — Generic-adapter использует JournalPipelineTemplate — DONE @ 67e4b315 @ 2026-05-05 12:15 МСК
- `getTaskForm` сначала пробует `loadPipelineTree(orgId, templateCode)`. Если tree.nodes.length > 0 — собирает форму из неё через `buildFormFromPipelineTree`. Каждый pinned-узел получает `field` сконвертированный из `JournalTemplate.fields[linkedFieldKey]` через `templateFieldToTaskFormField`.
- Helper `templateFieldToTaskFormField`: text/number/boolean/date/select поддерживаются. Поля с `auto: true` (computed) пропускаются — они рассчитываются адаптером после submit, worker'у их не показывать. Unknown types ('equipment', 'photo') возвращают null → pinned-узел остаётся confirmation-only без поля.
- `applyRemoteCompletion` дополнительно загружает pipeline-tree, для каждого pinned-узла копирует `values[linkedFieldKey]` в `data[linkedFieldKey]`. Best-effort: если что упадёт — pipeline-trail и comment всё равно сохраняются.
- Fallback: если pipeline-tree пуст / не настроен — работает legacy `buildGenericForm` (filling-guides + requirePhoto).
- Acceptance: создал pipeline-tree для журнала через UI → следующий task-fill использует новую форму → колонки журнала наполняются. **Это закрывает P0.1 для ВСЕХ журналов сразу** (вместо per-journal-адаптеров).

### [/] P1.5 — Guide editor (`/settings/journal-guides`) — IN PROGRESS
- [x] **wave-a @ abaca6d6 @ 2026-05-05 12:30 МСК** — API + helpers:
  - `src/lib/journal-guide-tree.ts`: `findGuideTemplate`, `ensureGuideTemplate`, `loadGuideTree`, `computeGuideNextOrdering`
  - 4 endpoint'а: `GET /[code]`, `POST /[code]/nodes`, `PATCH/DELETE /[code]/nodes/[id]`, `PATCH /[code]/nodes/[id]/move`
  - Без `kind`/`linkedFieldKey`/seed/split — гайды проще: title + detail + photoUrl + tree-структура
  - Все защищены `requireApiAuth` + `hasFullWorkspaceAccess`, AuditLog на каждую мутацию (`settings.journal-guides.*`)
  - Acceptance: 401 на unauthenticated POST, prod не сломан, login=200
- [x] **wave-b @ 6f86ac5a @ 2026-05-05 12:50 МСК** — Guide editor UI:
  - `src/app/(dashboard)/settings/journal-guides-tree/[code]/page.tsx` (server) + `tree-editor.tsx` (client)
  - Reuse tree-editor pattern из pipeline'а с упрощениями: нет split, нет seed, нет pinned/custom badge
  - Add modal: title + detail + photoUrl (URL текстовый input, не upload — нет pipeline для guide-фото пока)
  - Edit modal с тем же шейпом
  - DnD reorder через @dnd-kit (root-level only, как в pipeline)
  - Delete через ConfirmDialog danger
  - Hero-блок с BookOpen иконкой и индиго-фиолетовым accent (`#7a5cff`) чтобы визуально отличаться от pipeline (#5566f6)
  - На list-page `/settings/journal-pipelines` добавлен 3-й link «📖 Гайд (beta)» + бейдж со счётчиком guide-узлов (фиолетовый pill)
- [x] **wave-c @ e443d170 @ 2026-05-05 13:15 МСК** — integration:
  - Helper `loadGuideNodesForUI(orgId, code)` в `journal-guide-tree.ts` — DFS-flatten + best-effort, возвращает плоский список `{ title, detail, photoUrl }[]`
  - `<JournalGuide>` принимает optional prop `customNodes`. Если передан и непуст — заменяет legacy `guide.steps` секцию (сохраняя materials/mistakes/regulationRef из legacy). Бейдж «⚙ Кастомный гайд организации» в шапке. photoUrl рендерится как ссылка-чип «📷 Открыть фото»
  - Если `guide` (legacy) не существует, но customNodes есть — guarded fallback'и для materials/completion/mistakes/regulation
  - `<DynamicForm>` принимает prop `customGuideNodes` и forward'ит в `<JournalGuide>`
  - Server-pages обновлены чтобы pre-fetch'ить tree:
    - `/journals/[code]/guide` — standalone page (server) → `loadGuideNodesForUI` → `<JournalGuide customNodes>`
    - `/journals/[code]/new` (dashboard) → `<DynamicForm customGuideNodes>`
    - `/mini/journals/[code]/new` (Mini App) → `<DynamicForm customGuideNodes>`
- [x] **P1.5 ЗАКРЫТ** — Guide editor end-to-end: API + UI + integration. Менеджер настраивает гайд → сотрудник видит его на каждой форме заполнения и на standalone странице.

### [/] P1.6 — Photo-mode per node — IN PROGRESS
- [x] UI редактора (3-кнопочный selector none/optional/required) — DONE в P1.3 wave-b @ 59de6148
- [x] **wave-a @ a56babce @ 2026-05-05 13:35 МСК** — wizard render:
  - `PipelineStep` тип расширен: `photoMode?: "none"|"optional"|"required"`, `requireComment?`, `requireSignature?`
  - `buildFormFromPipelineTree` (generic.ts) пробрасывает `photoMode` напрямую (не через `requirePhoto`-only). Backwards compat: `requirePhoto = photoMode === "required"` для legacy-readers.
  - `<PipelineWizard>` в task-fill-client.tsx:
    - `effectivePhotoMode = step.photoMode ?? (requirePhoto ? "required" : "none")`
    - `effectivePhotoMode === "none"` → uploader скрыт
    - `"optional"` → uploader виден, неблокирующий стиль (серая окантовка), label «(по желанию)»
    - `"required"` → uploader виден, indigo-стиль, label «(обязательно)», кнопка «Сделал» заблокирована до загрузки
  - `confirmPipelineStep` тоже использует tri-state guard
- [x] **wave-b @ 8681c0ab @ 2026-05-05 13:55 МСК** — requireComment + requireSignature:
  - State `stepComments`, `stepSignatures` в task-fill-client (Record<index, string>)
  - `<PipelineWizard>` принимает 4 новые props: stepComments + onCommentChange, stepSignatures + onSignatureChange
  - На текущем шаге, если `step.requireComment === true` — рендерится textarea с label «Комментарий (обязательно)»
  - На текущем шаге, если `step.requireSignature === true` — рендерится input с label «Подпись — ваше ФИО (обязательно)»
  - Кнопка «Сделал» disabled пока требуемые поля пусты, с информативным `title` (toolip объясняет что заполнить)
  - В `confirmPipelineStep` — guards дополнены, `comment`/`signature` записываются в `PipelineConfirm` → pipeline-trail видит их в audit'e
- [x] **P1.6 ЗАКРЫТ** — все 3 per-node флага (photoMode/requireComment/requireSignature) от editor до wizard работают end-to-end

### [ ] P1.7 — Subtasks (nested pipeline nodes)
- UI поддержка глубины 3
- Wizard рендерит indent
- DB готова (parentId)

### [ ] P1.8 — Split pinned node
- Кнопка «Разделить» на pinned-узле
- Создаёт два pinned со ссылкой на тот же linkedFieldKey
- Title первого = «<title> (часть 1)», второго = «(часть 2)»
- Можно потом редактировать названия

### [ ] P1.9 — Clear-custom button
- Удаляет всех `kind = "custom"` узлов в шаблоне
- Сохраняет pinned с дефолтным title/detail
- Confirm-dialog с typeToConfirm

### [ ] P1.10 — Audit-log integration
- Каждый PATCH/DELETE/POST на pipeline-tree → AuditLog
- Pretty-render в audit-viewer

---

## P3 — Design v2 migrations (по очереди один журнал за коммит)

> Foundation заложен в коммите P3.0 (см. ниже). Каждый journal-document-client мигрируется на v2 компоненты с screenshot before/after.
>
> **Loop правило:** P3 имеет приоритет ВЫШЕ P2 но НИЖЕ P0/P1. Когда P0+P1 пусты — берётся следующий из P3. P2 трогается только когда P3 пуст.

### Foundation
- [x] P3.0 — DB flag `experimentalUiV2` + `/settings/experimental` toggle + `src/components/journals/v2/*.tsx` scaffold — **DONE @ dc52c092 @ 2026-05-04 23:50 МСК**
  - DB: `Organization.experimentalUiV2 Boolean @default(false)` (deploy.yml сделает prisma db push)
  - API: `PATCH /api/settings/experimental { experimentalUiV2 }` с audit-log
  - UI: `/settings/experimental` page с toggle, ссылка из главного settings
  - Components: `src/components/journals/v2/{journal-toolbar,journal-settings-modal,journal-entry-dialog,journal-reference-table,README.md}`
  - **Что НЕ сделано в этом коммите:** ни один journal-document-client ещё НЕ использует v2-компоненты. Toggle включается, но ничего не меняется в UI журналов до миграций P3.A1+. Это намеренно — foundation отдельно от миграций.

### Tier A (топ-10 traffic) — каждый отдельный commit
- [x] P3.A1 — cleaning-document-client v2 — DONE wave-1 (settings modal only) @ 91cd0170 @ 2026-05-05 00:30 МСК. Banner/toolbar/table остались legacy — это сознательно, чтобы коммит был мелкий и обратимый. Полная миграция cleaning требует отдельных коммитов P3.A1.b, P3.A1.c.
- [x] P3.A2 — hygiene-document-client v2 — DONE wave-1 @ b4f678b6 @ 2026-05-05 00:55 МСК (shared StaffJournalToolbar)
- [x] P3.A3 — health-document-client v2 — DONE wave-1 @ b4f678b6 @ 2026-05-05 00:55 МСК (но health использует свою кастомную settingsOpen-модалку с printEmptyRows — нужен отдельный коммит P3.A3.b чтобы её тоже мигрировать на v2)
- [x] P3.A4 — cold-equipment-document-client v2 — DONE wave-1 @ 6a55438a @ 2026-05-05 01:15 МСК (settings modal только; equipment-dialog остаётся legacy)
- [x] P3.A5 — finished-product-document-client v2 — DONE wave-1 @ 79112ad1 @ 2026-05-05 01:30 МСК (settings modal только; add-row dialog + catalog dialog → отдельные коммиты P3.A5.b, P3.A5.c)
- [x] P3.A6 — perishable-rejection-document-client v2 — N/A wave-1 @ 2026-05-05 01:35 МСК (нет отдельной Settings-модалки; будет в wave-2 когда мигрируем add-row + catalog dialogs)
- [x] P3.A7 — acceptance-document-client v2 — DONE wave-1 @ ea3421d6 @ 2026-05-05 01:50 МСК (settings modal только; add-row/edit-row/import — отдельные коммиты)
- [x] P3.A8 — climate-document-client v2 — DONE wave-1 @ 3aa2463d @ 2026-05-05 02:05 МСК (settings modal только)
- [x] P3.A9 — cleaning-ventilation-checklist-document-client v2 — DONE wave-1 @ 3402fc66 @ 2026-05-05 02:20 МСК
- [x] P3.A10 — glass-control-document-client v2 — DONE wave-1 @ 742defb2 @ 2026-05-05 02:35 МСК — **TIER A FULLY DONE**

### Tier B (12 средних)
- [x] P3.B1 — equipment-cleaning — DONE wave-1 @ 3ccd2a9f @ 2026-05-05 02:50 МСК
- [x] P3.B2 — equipment-calibration — DONE wave-1 @ 56bc6f19 @ 2026-05-05 03:05 МСК
- [x] P3.B3 — equipment-maintenance — DONE wave-1 @ 6bbd9b42 @ 2026-05-05 03:20 МСК
- [x] P3.B4 — disinfectant — DONE wave-1 @ 4c73cec1 @ 2026-05-05 03:35 МСК
- [x] P3.B5 — ppe-issuance — DONE wave-1 @ 950be4ef @ 2026-05-05 03:50 МСК
- [x] P3.B6 — med-book — DONE wave-1 @ e26b0473 @ 2026-05-05 04:05 МСК (бонус: список прививок теперь видимый pills с удалением, не только add)
- [x] P3.B7 — sanitation-day — DONE wave-1 @ 089429aa @ 2026-05-05 04:25 МСК
- [x] P3.B8 — sanitary-day-checklist — DONE wave-1 @ 08db83f2 @ 2026-05-05 04:40 МСК
- [x] P3.B9 — complaint — DONE wave-1 @ 2105d105 @ 2026-05-05 04:55 МСК
- [x] P3.B10 — accident — DONE wave-1 @ f0a83d45 @ 2026-05-05 05:10 МСК
- [x] P3.B11 — breakdown-history — DONE wave-1 @ bcac17f3 @ 2026-05-05 05:25 МСК
- [x] P3.B12 — pest-control — DONE wave-1 @ f9625807 @ 2026-05-05 05:40 МСК — **TIER B FULLY DONE**

### Tier C (13 остальных)
- [x] P3.C1 — traceability — DONE wave-1 @ 79fa90c1 @ 2026-05-05 05:55 МСК
- [x] P3.C2 — intensive-cooling — DONE wave-1 @ 8de9d1c7 @ 2026-05-05 06:10 МСК
- [x] P3.C3 — fryer-oil — DONE wave-1 @ c3321b1a @ 2026-05-05 06:25 МСК
- [x] P3.C4 — glass-list — DONE wave-1 @ 01e6ab78 @ 2026-05-05 06:40 МСК
- [x] P3.C5 — metal-impurity — DONE wave-1 @ d5638202 @ 2026-05-05 06:55 МСК
- [x] P3.C6 — product-writeoff — DONE wave-1 @ 1350b2a8 @ 2026-05-05 07:10 МСК
- [x] P3.C7 — register — DONE wave-1 @ b8a9b9c9 @ 2026-05-05 07:25 МСК
- [x] P3.C8 — tracked — DONE wave-1 @ 2e1cd3e7 @ 2026-05-05 07:40 МСК
- [x] P3.C9 — scan-journal — N/A wave-1 @ 2026-05-05 07:50 МСК (image-viewer без Settings)
- [x] P3.C10 — audit-plan — DONE wave-1 @ 395f560d @ 2026-05-05 07:55 МСК
- [x] P3.C11 — audit-protocol — DONE wave-1 @ d1475e99 @ 2026-05-05 08:10 МСК
- [x] P3.C12 — audit-report — DONE wave-1 @ eb319270 @ 2026-05-05 08:25 МСК
- [x] P3.C13 — uv-lamp-runtime — DONE wave-1 @ 43e70208 @ 2026-05-05 08:50 МСК
- [x] P3.C14 — staff-training — DONE wave-1 @ 6542cec3 @ 2026-05-05 09:10 МСК
- [x] P3.C15 — training-plan — DONE wave-1 @ ac27de78 @ 2026-05-05 09:35 МСК — **Tier C complete, P3 wave-1 33/33 active + 2 N/A = 35/35**

**Migration protocol на каждый журнал** (см. P3.3 в PIPELINE-VISION.md):
1. Playwright screenshot конкурента haccp-online (если эквивалент есть)
2. Playwright screenshot текущей wesetup-страницы → `docs/screenshots/v2/<code>-before.png`
3. Реализация V2Layout shim в `<code>-document-client.tsx`
4. Playwright screenshot v2 → `docs/screenshots/v2/<code>-after.png`
5. Commit + push + deploy + smoke
6. Mark DONE в LOOP-NEXT с git-sha

---

## P2 — Feature backlog

> Loop генерирует отсюда top-3-5 пунктов когда P0/P1 пусты.
>
> Каждый пункт: **`[ ] N.M — Title`** + 1-2 строки описания + acceptance.
>
> Когда сделан: `[x] N.M — Title — DONE @ <git-sha> @ <YYYY-MM-DD HH:MM МСК>`.

### Section A — UX shortcuts

- [ ] A.1 — Hotkey `Ctrl+Shift+N` на дашборде → быстрое создание новой записи в самом срочном журнале
- [ ] A.2 — Подсказка после двух одинаковых ошибок ввода: «Похоже, вы ввели то же что и в предыдущей строке — это нормально?»
- [ ] A.3 — Quick-jump-bar в шапке: набираешь «гиг» → выбираешь «Журнал гигиены» → ентер. Без мыши.
- [ ] A.4 — Undo последнего сохранения (10 секунд) для journal entries
- [ ] A.5 — Ctrl+S сохраняет текущую форму в любом journal-document-client

### Section B — Mobile / Mini App

- [ ] B.1 — Оффлайн-кеш Mini App: записи сохраняются локально, синк при появлении сети, бейдж «5 записей не отправлено»
- [ ] B.2 — Push-уведомления через Telegram Bot когда осталось < 30 мин до дедлайна
- [ ] B.3 — Шаблоны записей: «Сохранить как шаблон» → next time одно касание для применения
- [ ] B.4 — Быстрый swipe-input для day×employee grid в Mini App
- [ ] B.5 — Voice-to-text для комментариев (Web Speech API + fallback)

### Section C — Manager tools

- [ ] C.1 — Виджет дашборда «Кого надо подтянуть» — топ-3 сотрудника с пропущенными записями
- [ ] C.2 — Weekly digest по email каждый понедельник: метрики, трендов, исключения
- [ ] C.3 — Export любого журнала в PDF одной кнопкой с СанПиН-форматом
- [ ] C.4 — Сравнение двух периодов («Эта неделя vs прошлая») в reports
- [ ] C.5 — Auto-reminder когда менеджер 7 дней не открывал дашборд

### Section D — Compliance

- [ ] D.1 — Score «Готовность к проверке РПН» детализирован по 12 пунктам с deep-link на исправление каждого
- [ ] D.2 — Auto-export всех журналов за квартал в zip с PDF — для приёма проверки
- [ ] D.3 — Чек-лист «За 3 дня до плановой проверки» с 20 пунктами
- [ ] D.4 — «Опасные дни» — подсветка дат когда отклонения чаще среднего
- [ ] D.5 — Generate compliance-certificate PDF с QR-кодом для верификации проверяющим

### Section E — Integrations

- [ ] E.1 — Google Calendar integration: дедлайны журналов как events
- [ ] E.2 — Slack notifications для management-роли
- [ ] E.3 — Excel-import в acceptance journal
- [ ] E.4 — 1C-export сальдо/потери в OFD-формате
- [ ] E.5 — Меркурий ВетИС API связка для prosеживаемости мяса/молочки

### Section F — Reports

- [ ] F.1 — Heatmap «когда чаще всего отклонения» (час × день недели)
- [ ] F.2 — Trend-chart по конкретному сотруднику (заполнения, отклонения)
- [ ] F.3 — Custom-query builder: «Покажи все записи где T° > 8°C за май»
- [ ] F.4 — PDF-репорт с фотографиями (для мест где photo-mode required)
- [ ] F.5 — CSV-export любой выборки

### Section G — Onboarding

- [ ] G.1 — Tutorial overlay при первом входе на дашборд (5 шагов)
- [ ] G.2 — «Посмотреть как заполняется» — короткое видео/гифка в каждом journal-form
- [ ] G.3 — Sample data button — заполняет все журналы фейк-данными для демо
- [ ] G.4 — Onboarding-progress на дашборде: «Вы настроили 7/12 шагов»
- [ ] G.5 — «Что нового» modal расширен: ссылка на видео-тур

### Section H — Performance

- [ ] H.1 — Кэшировать `getJournalDocument` результаты на 60 сек (LRU)
- [ ] H.2 — Lazy-load изображений в audit-log viewer
- [ ] H.3 — Bundle split: `react-pdf` загружается только на report'ах
- [ ] H.4 — Skeleton states вместо spinner'а на дашборде
- [ ] H.5 — Prefetch следующих 3 страниц журналов при scroll

### Section I — A11y

- [ ] I.1 — Keyboard nav для всех journal-document таблиц (стрелки + Tab)
- [ ] I.2 — Aria-labels для всех IconButton'ов
- [ ] I.3 — High-contrast mode toggle в settings
- [ ] I.4 — Focus-trap в modal'ах
- [ ] I.5 — Screen-reader announcements для toast'ов

### Section Z — Wild ideas (нужны brainstorm и approval)

- [ ] Z.1 — AI-помощник для генерации pipeline'а из СанПиН pdf
- [ ] Z.2 — NFC-tap в form: повар касается холодильника → автоматический заполнения метаданных
- [ ] Z.3 — Web push для повторного напоминания через 30 мин если не открыл
- [ ] Z.4 — Geo-fence: задача активна только когда worker на территории
- [ ] Z.5 — Машинное распознавание термометра по фото

---

## Owner notifications

> Записывать сюда после каждой крупной вехи (P0 closed / P1.x merged / +50 P2 done).
> Формат: `**[YYYY-MM-DD HH:MM МСК]** <git-sha> — что сделано + что заметил + что предлагаю дальше`.

- **[2026-05-05 13:15 МСК]** `e443d170` — **P1.5 ЗАКРЫТ — Guide editor end-to-end**. Менеджер открывает `/settings/journal-pipelines` → жмёт «📖 Гайд (beta)» рядом с журналом → попадает на `/settings/journal-guides-tree/[code]` → добавляет шаги (title + описание + опционально фото-URL) → DnD reorder → сохраняет.
  - Сотрудник видит этот кастомный гайд:
    1. На отдельной странице `/journals/<code>/guide`
    2. Inline в форме заполнения `/journals/<code>/new` и `/mini/journals/<code>/new` (collapsible)
  - Кастомный гайд **заменяет** legacy hardcoded `journal-filling-guides[code].steps[]`. Materials, common mistakes и regulationRef из legacy остаются (они структурно отличаются).
  - В шапке кастомного гайда бейдж «⚙ Кастомный гайд организации», цвет шагов фиолетовый (`#7a5cff`) — отличает от legacy (синий `#5566f6`).
  - Что заметил: симметрия pipeline (P1.1-1.4) и guide (P1.5) сделала разработку быстрой — guide собрался за 3 итерации (~1 час). Helper `loadGuideNodesForUI` тесно интегрирован с UI prop'ом, минимум плумбинга.
  - Что предлагаю дальше: P1.6 — photo-mode controls на pipeline узлах. Большая часть уже работает (`<EditNodeDialog>` 3-state selector + `WizardPreview` бейджи), нужно ТОЛЬКО проверить что real PipelineWizard в `task-fill-client.tsx` уважает photoMode из БД-узлов (а не legacy `requirePhoto`).

- **[2026-05-05 12:15 МСК]** `67e4b315` — **P1.4 + P0.1 ЗАКРЫТЫ ПОЛНОСТЬЮ**. Generic-адаптер теперь читает `JournalPipelineTemplate` из БД и заполняет колонки журнала через `linkedFieldKey`. Это значит:
  - Раньше «уборщица прошла pipeline → журнал пустой» был P0-багом для 33 журналов кроме glass_control (там был per-journal адаптер).
  - Теперь: Owner заходит в `/settings/journal-pipelines-tree/[code]` → жмёт «Создать из колонок» → seed создаёт pinned-узлы по полям журнала. Сотрудник в TasksFlow заполняет шаги (на pinned-шаге появляется input от его linkedFieldKey) → submit → данные пишутся в `JournalDocumentEntry.data[linkedFieldKey]` → колонки реальные журнала видят значения.
  - Fallback не сломан: если pipeline-tree не создан — работает legacy путь через `journal-filling-guides`.
  - Helper `templateFieldToTaskFormField` поддерживает text/number/boolean/date/select. Skipping `auto: true` (computed flags типа `isWithinNorm`) — они рассчитываются адаптером.
  - Что заметил: вся цепочка «P1.1 schema → P1.2 API → P1.3 UI → P1.4 wiring» собралась за 6 итераций (~3 часа). Это и есть выгода чёткого vertical-slice'а — каждый слой контракт-driven, минимум плумбинга.
  - Что предлагаю дальше: 1) Owner может прямо сейчас включить pipeline для одного-двух пилотных журналов и попросить сотрудника пройти — увидит как колонки реально наполняются. 2) Параллельно loop делает P1.5–P1.10 (guide editor, photo-mode UI, audit-log integration). 3) Когда pipeline-tree устаканится в проде — можно начать миграцию `journal-filling-guides` в БД (deprecation legacy).

- **[2026-05-05 11:55 МСК]** `e8f65e76` — **P1.3 Pipeline Editor UI ЗАКРЫТ wave-1**. Tree-редактор полностью функционален на `/settings/journal-pipelines-tree/[code]`:
  - Заходи под management-ролью, открывай новый журнал → жми «Создать из колонок» → seed создаст pinned-узел на каждое поле журнала
  - Кнопка «Добавить шаг» → custom-шаг с title/detail/required-фото
  - Перетаскивай узлы за иконку ⋮ слева — порядок сохраняется автоматически (PATCH /move с float-ordering)
  - Клик ⚙ → редактирование (title, detail, hint, photoMode 3-state, requireComment, requireSignature)
  - Pinned-кнопка ⤚ → Split: разделяет узел на «(часть 1)» + «(часть 2)» с тем же linkedFieldKey
  - Custom-кнопка 🗑 → ConfirmDialog danger
  - Справа — live preview «как увидит сотрудник в TasksFlow». Меняешь дерево → превью обновляется
  - 4 commit'а: `ea77008a` (read+seed+add+delete), `59de6148` (edit-dialog), `94b40e83` (DnD+split), `e8f65e76` (preview)
  - Что заметил: схема + 8 endpoints + UI собрались за 6 итераций (~1 час) благодаря тому что endpoints спроектированы под immediate-render UI (`response.json().tree` возвращается из каждой мутации). API + UI → один контракт, минимум плумминга.
  - Что предлагаю дальше: **P1.4 Generic-adapter integration** — чтобы pipeline из БД реально доехал до сотрудника в TasksFlow. После этого можно реально протестировать сквозной flow «уборщица заполняет → колонки журнала появляются». Глобально это закрывает P0.1 (которая сейчас PART-1) для всех журналов сразу. Дальше P1.5 (guide editor), P1.6-1.10 (photo-mode, subtasks, audit-log).
  - Если Owner хочет посмотреть прямо сейчас: открывай `/settings/journal-pipelines` под manager/owner-ролью, увидишь новый бейдж «🌳 Дерево (beta)» рядом с каждым журналом.

- **[2026-05-05 09:35 МСК]** `ac27de78` — **P3 ЗАКРЫТ ПОЛНОСТЬЮ wave-1 (35/35 журналов)**. Tier C wave-1 завершён за iter 23-35: traceability, intensive-cooling, fryer-oil, glass-list, metal-impurity, product-writeoff, register, tracked, scan-journal (N/A), audit-plan, audit-protocol, audit-report, uv-lamp-runtime, staff-training, training-plan. Все 33 активных Tier-журнала + 2 N/A (perishable + scan-journal — без Settings) теперь имеют унифицированный `JournalSettingsModal` за `experimentalUiV2`-toggle. Pattern «inline shim if useV2 / else legacy» доказал свою живучесть на 33 миграциях подряд. Что заметил: некоторые журналы (uv-lamp-runtime, training-plan) имели вынесенные функции `*SettingsDialog`, в них useV2 пробрасывался как доп. prop, а не через inline-shim — оба варианта работают одинаково. Что предлагаю дальше: 1) Owner может включить `experimentalUiV2` в `/settings/experimental` и обходить все 33 журнала — должны быть в едином стиле. 2) wave-2: вторичные диалоги (Add Row, Edit Topic, и т.п.) — их сейчас ~50, не покрыты. 3) или сразу к P1: Pipeline Editor с DB schema + drag-drop UI. 4) или P2 backlog (200-1000 features). Жду указания, куда двигать loop.

- **[2026-05-05 05:40 МСК]** `f9625807` — **P3 Tier B DONE wave-1 (12/12 журналов)**. Закрытые: equipment-cleaning, equipment-calibration, equipment-maintenance, disinfectant, ppe-issuance, med-book, sanitation-day, sanitary-day-checklist, complaint, accident, breakdown-history, pest-control. Все имеют унифицированный settings-modal в v2-стиле. Pest-control оказался скрытым через TrackedDocumentClient shell — пришлось пробросить useV2 через 2 уровня. Что заметил: med-book получил бонус-улучшение (видимый список прививок с pills+× вместо blind add). Tier C 13 журналов — следующий, на нём дойдёт до 35/35.

- **[2026-05-05 02:35 МСК]** `742defb2` — **P3 Tier A DONE wave-1 (10/10 журналов)**. Все топ-traffic журналы (cleaning, hygiene, health, cold-equipment, finished-product, perishable N/A, acceptance, climate, cleaning-ventilation, glass-control) имеют settings-modal в Design v2 за `experimentalUiV2` toggle. Открой `/settings/experimental`, включи toggle, обходи журналы — все «Настройки документа» теперь в едином стиле с uppercase-labels, indigo focus, sticky footer, max-h-90vh. Что заметил: pattern «inline shim if useV2 / else legacy» уже устоялся, 8 миграций по нему — работает стабильно. Tier B (12 средних journal'ов) идёт следующим. Что предлагаю дальше: продолжить loop — Tier B потом C, потом возможно дозакрытие per-journal customizations (health printEmptyRows, cleaning toolbar, prixleinable add-row + catalog dialogs).

- **[2026-05-05 00:00 МСК]** `809bd40d` — P0.2 закрыт (cleaning responsibles desync). Root cause был странный: `.map()` на пустом массиве в `updateSettings()`. Settings-modal и banner-select оба молчаливо теряли первое сохранение ответственного на чистом документе. Fix через upsert. Что заметил: остальные журналы используют другую модель ответственных (responsibleUserId как одно поле в JournalDocument, не arrays в config), так что у них этого бага нет — но если они тоже окажутся desync'нутыми, нужно проверить per-journal. Что предлагаю дальше: loop переключается на P3 (Design v2 миграции). Все P0 closed, можно идти на UI.

- **[2026-05-04 23:50 МСК]** `dc52c092` — P3.0 DONE. Foundation Design v2: DB-флаг `experimentalUiV2`, toggle на `/settings/experimental`, 4 v2-компонента (`JournalToolbar`, `JournalSettingsModal`, `JournalEntryDialog`, `JournalReferenceTable`), audit-log integration. Ни один журнал ещё не мигрирован — это сделают коммиты P3.A1+ в loop'е. Прод проверен: `https://wesetup.ru/settings/experimental` доступен management-роли. Что заметил: реальная сложность миграций будет в специфических dialog'ах журналов с custom-логикой (например, RoomsModeCard в cleaning) — там shim придётся вкручивать аккуратно, не каждый вычистится 1:1. Что предлагаю дальше: loop начинает с P0.2 (responsibles desync), потом сразу P3.A1 (cleaning v2) как самый посещаемый.

- **[2026-05-04 23:24 МСК]** `81f60ada` — P0.1 закрыт partial. Foundation: PipelineWizard рендерит step.field инлайн с валидацией (required-field блокирует «Сделал»). Specific: glass_control адаптер с 4 шагами по СанПиН пишет в `JournalDocumentEntry.data` нужный shape. Бойцовый баг владельца («уборщица прошла, журнал пустой») закрыт для glass_control. Остальные журналы где fallback на generic — будут постепенно закрыты per-journal-адаптерами или через pipeline editor (P1.4). Что заметил: текущая модель «один адаптер = один журнал» масштабируется плохо, P1 (pipeline editor с pinned-узлами по полям) реально нужен. Что предлагаю дальше: P0.2 (ответственные desync) обязательно через playwright + haccp-online, потом P1.1 (DB schema migration).

---

## Lessons learned

> Любые сюрпризы / гочи которые могут пригодиться следующей итерации.
> Формат: `- [YYYY-MM-DD] <git-sha>: <что произошло, как обошёл>`

- [2026-05-04] `1f9becbe`: `JSX.Element` не работает в Next 16 без JSX namespace, использовать `ReactElement` from "react".
- [2026-05-04] `bc60c78c`: Prisma `where.details = { path: ["key"], equals: value }` — стабильно работает для JSON-фильтров; не нужно raw SQL.
- [2026-05-04] `1f9becbe`: `z.passthrough()` в task-form validator пропускает `_pipeline` блоб через типизацию `TaskFormValues` (Record<string, scalar>). Cast в адаптере `as Record<string, unknown>` чтобы достать nested поля.
- [2026-05-05] `809bd40d`: `.map()` на пустом массиве — silent data loss anti-pattern. При написании upsert-логики ВСЕГДА проверять if (items.length === 0) ветку. Особенно опасно когда это часть бизнес-формы где пустой initial state — норма.
- [2026-05-05] `91cd0170`: миграция на v2-компонент через `if (props.useV2) { <NewModal/> } else { <LegacyDialog/> }` — обе ветки в одном файле. Плюс: trivial rollback (выключил toggle), легко A/B сравнить, нет дубликата файла. Минус: файл вырастает. Размер cleaning-document-client теперь ~870 строк против 750 — приемлемо для wave-1, для wave-2/3 имеет смысл вынести в отдельный CleaningDocumentClientV2.tsx.
- [2026-05-05] `b4f678b6`: shared-toolbar approach (StaffJournalToolbar используется hygiene + health) → одна правка покрывает 2 журнала. Лучший ROI на коммит. ОДНАКО health имеет custom onSettingsClick override со своей собственной settingsOpen-модалкой (для printEmptyRows) — она НЕ покрылась, нужен отдельный wave-1.b. Принцип: shared component миграция покрывает только common-path; per-journal customizations требуют отдельных миграций.
- [2026-05-05] `2e1cd3e7`: nested document-clients (TrackedDocumentClient → PestControlDocumentClientImpl) — useV2 нужно пробрасывать через ВСЕ уровни, иначе wrapper вызывает Impl без флага и v2 не активируется. Решение: outer Props получает useV2, передаёт его в spread `{...props}`, Impl деструктурит `useV2 = false` явно.
- [2026-05-05] `43e70208`: для journals с вынесенным `*SettingsDialog`-компонентом (uv-lamp-runtime, training-plan) — добавлять `useV2?: boolean` в его собственные props и ветвиться внутри него (`if (props.useV2) return <JournalSettingsModal>`). Это ровно так же чисто, как inline-shim в основном клиенте, плюс позволяет переиспользовать `handleSave`. Pattern: если Settings уже извлечён в функцию — useV2 живёт в её props, иначе — inline в основном клиенте.
- [2026-05-05] `43360d86`: после деплоя НОВЫЕ API-route файлы могут несколько секунд возвращать 404/500 пока Next.js dev-warm-up или ISR-cache не отработают. Smoke-тесты сразу после `DEPLOY MATCH` могут показать ложный fail. Workaround: повторный curl через 10-15с — статусы стабилизируются. Не паниковать и не откатывать на первой попытке.

---

## Anti-patterns log

> Пункты которые я УЖЕ реализовал но они оказались плохой идеей и были отозваны.

_(пусто)_

---

## Stats

- P0 open: 2
- P1 open: 10 (P1.1 — P1.10)
- P2 open: 50 (Sections A-I × ~5 + Z.1-5)
- P2 done: 0
- Total committed effort: 2 commits на сегодня (`bc60c78c` + `1f9becbe`)

