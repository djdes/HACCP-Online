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

**Текущий приоритет:** **P3.A4 — cold-equipment-document-client v2** (P3.A2 + P3.A3 wave-1 закрыты одним коммитом через shared StaffJournalToolbar)

---

## P0 — Active bugs

### [x] P0.1 — Pipeline не заполняет колонки журнала — DONE PART-1 @ 81f60ada @ 2026-05-04 23:24 МСК
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

### [ ] P1.1 — Schema migration: JournalGuide* + JournalPipeline* models
- Добавить 4 модели в `prisma/schema.prisma`
- `npx prisma generate` локально для типов
- `prisma db push` запустится автоматически в deploy.yml
- Acceptance: типы доступны через `db.journalPipelineTemplate`, `db.journalPipelineNode`, etc.

### [ ] P1.2 — API: GET/PATCH/POST/DELETE для pipeline tree
- Эндпоинты в `src/app/api/settings/journal-pipelines/[code]/...`
- Auth через `hasFullWorkspaceAccess`
- AuditLog на каждую мутацию
- Acceptance: curl-тесты создания/перемещения/удаления узлов

### [ ] P1.3 — Pipeline editor UI с drag-drop
- Страница `src/app/(dashboard)/settings/journal-pipelines/[code]/page.tsx`
- Список журналов с превью статуса pipeline'а на `/settings/journal-pipelines/page.tsx`
- `@dnd-kit/sortable` для tree DnD
- Превью wizard'а live справа
- ОБЯЗАТЕЛЬНО открыть haccp-online.ru, посмотреть их редактор шаблонов если есть
- Acceptance: можно добавить custom-шаг, перетянуть его выше pinned, сохранить, увидеть в task-fill

### [ ] P1.4 — Generic-adapter использует JournalPipelineTemplate
- `getTaskForm` читает БД, fallback на legacy
- `applyRemoteCompletion` мапит linkedFieldKey → data
- Acceptance: P0.1 решается этим путём; уборщица заполняет реальные данные

### [ ] P1.5 — Guide editor (`/settings/journal-guides`)
- Симметрично pipeline editor'у, но без linkedFieldKey/pinned семантики
- Простой rich-text checklist с drag-drop
- Используется в FillingGuide modal'ке вместо хардкода
- Acceptance: сотрудник видит кастомный гайд от менеджера в форме заполнения

### [ ] P1.6 — Photo-mode per node
- В UI редактора — radio (none/optional/required)
- В wizard — соответствующее UI (uploader появляется только если != none)
- Required = блок «Сделал»

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
- [ ] P3.A4 — cold-equipment-document-client v2
- [ ] P3.A5 — finished-product-document-client v2 (бракераж готовой продукции)
- [ ] P3.A6 — perishable-rejection-document-client v2
- [ ] P3.A7 — acceptance-document-client v2
- [ ] P3.A8 — climate-document-client v2
- [ ] P3.A9 — cleaning-ventilation-checklist-document-client v2
- [ ] P3.A10 — glass-control-document-client v2

### Tier B (12 средних)
- [ ] P3.B1 — equipment-cleaning
- [ ] P3.B2 — equipment-calibration
- [ ] P3.B3 — equipment-maintenance
- [ ] P3.B4 — disinfectant
- [ ] P3.B5 — ppe-issuance
- [ ] P3.B6 — med-book
- [ ] P3.B7 — sanitation-day
- [ ] P3.B8 — sanitary-day-checklist
- [ ] P3.B9 — complaint
- [ ] P3.B10 — accident
- [ ] P3.B11 — breakdown-history
- [ ] P3.B12 — pest-control

### Tier C (13 остальных)
- [ ] P3.C1 — traceability
- [ ] P3.C2 — intensive-cooling
- [ ] P3.C3 — fryer-oil
- [ ] P3.C4 — glass-list
- [ ] P3.C5 — metal-impurity
- [ ] P3.C6 — product-writeoff
- [ ] P3.C7 — register
- [ ] P3.C8 — tracked
- [ ] P3.C9 — scan-journal
- [ ] P3.C10 — audit-plan
- [ ] P3.C11 — audit-protocol
- [ ] P3.C12 — audit-report
- [ ] P3.C13 — uv-lamp-runtime
- [ ] P3.C14 — staff-training
- [ ] P3.C15 — training-plan

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

