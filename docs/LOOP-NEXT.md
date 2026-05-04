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

**Текущий приоритет:** **P0.2 — Ответственные desync между таблицей и settings** (P0.1 закрыт частично, см. ниже)

---

## P0 — Active bugs

### [x] P0.1 — Pipeline не заполняет колонки журнала — DONE PART-1 @ pending-sha @ 2026-05-04
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

### [ ] P0.2 — Ответственные desync между таблицей и settings
- **Описание:** Saved table responsibles не синхронизированы с settings-modal
- **PRECONDITION:** ОБЯЗАТЕЛЬНО открыть https://lk.haccp-online.ru/docs/1 (test4/test8) и посмотреть как у них реализовано — НЕ угадывать
- **Файлы (примерно):** `src/components/journals/cleaning-document-client.tsx` (settings dialog), `src/lib/cleaning-document.ts`, API endpoint в `src/app/api/journal-documents/[id]/route.ts`
- **Acceptance:** изменение в таблице → видно в модалке; изменение в модалке → видно в таблице; единый AuditLog на изменение

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

_(пусто — первая итерация ещё не была)_

---

## Lessons learned

> Любые сюрпризы / гочи которые могут пригодиться следующей итерации.
> Формат: `- [YYYY-MM-DD] <git-sha>: <что произошло, как обошёл>`

- [2026-05-04] `1f9becbe`: `JSX.Element` не работает в Next 16 без JSX namespace, использовать `ReactElement` from "react".
- [2026-05-04] `bc60c78c`: Prisma `where.details = { path: ["key"], equals: value }` — стабильно работает для JSON-фильтров; не нужно raw SQL.
- [2026-05-04] `1f9becbe`: `z.passthrough()` в task-form validator пропускает `_pipeline` блоб через типизацию `TaskFormValues` (Record<string, scalar>). Cast в адаптере `as Record<string, unknown>` чтобы достать nested поля.

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

