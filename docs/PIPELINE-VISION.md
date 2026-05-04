# Pipeline Vision — мастер-план

**Создано:** 2026-05-04
**Автор:** ТЗ от владельца WeSetup, оформление — agent
**Связанный live-трекер:** [`LOOP-NEXT.md`](./LOOP-NEXT.md)
**Назначение:** долгоживущий backlog для `/loop 10m`-сессий. Каждая итерация цикла читает этот файл + `LOOP-NEXT.md`, выбирает следующий приоритетный пункт, делает, коммитит, пушит, ждёт деплой, проверяет на проде, помечает в `LOOP-NEXT.md` как DONE с git-sha и переходит к следующему.

---

## TL;DR

Текущий pipeline (см. коммиты `bc60c78c` + `1f9becbe`) — это **evidence-театр**: сотрудник проходит шаги, аудит-лог пишется, но **колонки журнала остаются пустые**. Это не контроль, это иллюзия контроля. Боевой пример: уборщица прошла pipeline у glass_control — журнал пустой.

**Цель:** превратить pipeline в **полноценный заполнитель** журнала с гибким редактором, drag-drop иерархией, фото-доказательствами и pinned-узлами которые мапят шаги в реальные колонки журнала.

---

## P0 — критические баги (делать ПЕРВЫМИ, до любого P1/P2)

### P0.1 — Pipeline не заполняет журнал

**Симптом (баг боевой, найден владельцем 2026-05-04):**
Уборщица в TasksFlow получает задачу glass_control. Видит pipeline. Проходит шаги «Осмотри по описи / Защищенность ламп / Зафиксируй итог». Жмёт «Готово». Но в `JournalDocumentEntry` в БД у строки нет данных — только `{source: "tasksflow", pipeline: [...trail...]}`. Открываешь журнал → колонки пустые → проверка РПН — это «фактически не заполнено».

**Где сейчас написан код:**
`src/lib/tasksflow-adapters/generic.ts` → `applyRemoteCompletion`. Сейчас сохраняет:
```
data = { source, templateCode, completedAt, comment?, pipeline? }
```
Никаких полей журнала. Проблема: `JournalDocumentEntry.data` для glass_control должен содержать колонки типа `productName`, `quantity`, `defectStatus`, `actionTaken`. Сейчас они туда не попадают.

**Fix:**
Pipeline должен иметь возможность собирать данные. Минимальный путь:
1. На каждом `PipelineStep` добавить опциональный `field?: TaskFormField` (тип уже есть в `task-form.ts`, но в generic-адаптере не используется).
2. UI wizard'а: если у шага есть `field` — рендерить input ВНУТРИ карточки шага между «detail» и «Сделал». Кнопка «Сделал» становится disabled пока поле не заполнено (если required).
3. На submit все собранные значения мапятся в `JournalDocumentEntry.data` по ключу поля.
4. Generic-адаптер для журналов с подходящим shape (известный `JournalSpec.fields`) может авто-генерить pinned-шаги по полям журнала.

**Acceptance:**
- Уборщица проходит pipeline glass_control → в `/journals/glass_control/documents/<id>` строка содержит колонки с реальными данными которые она ввела.
- Если шаг с required field оставлен пустым — submit не проходит, понятная ошибка.
- Manual-test через playwright прод-аккаунт.

---

### P0.2 — Ответственные desync между таблицей и settings

**Симптом:**
В журнале (например cleaning) сохраняешь ответственных в табличной части документа → они появляются в таблице. Открываешь модалку «Настройки журнала» → там старые/пустые/чужие значения. Юзер не понимает, кто реально ответственный.

**Корень:**
Скорее всего две разные модели:
- Табличные ответственные хранятся в `JournalDocumentConfig` (per-row или per-pair)
- В Settings dialog читается `JournalDocument.responsibleUserId` или `responsibleTitle`
Эти поля заполняются разными API-роутами и не синхронизируются.

**Fix:**
1. **Перед написанием** кода: открыть `lk.haccp-online.ru/docs/1`, тестовый акк `test4`/`test8`, посмотреть как у них настройки документа выглядят и какие ответственные там показываются. Скопировать модель данных, не угадывать.
2. Унифицировать: при сохранении settings — синхронизировать в config; при сохранении табличной части — обновлять `responsibleUserId` верхнего уровня. Single-source-of-truth = одно поле, второе = computed/projection.
3. Settings-модалка показывает то же что таблица.

**Acceptance:**
- Поменял ответственного в таблице → в модалке settings оно же.
- Поменял в settings → в таблице оно же.
- Audit-log пишется один раз на изменение, не два.

---

## P1 — Pipeline Editor (масштабная архитектурная задача)

Полная реализация ТЗ владельца от 2026-05-04.

### P1.1 — Two-block settings architecture

В `/settings/` появляются ДВА новых раздела:

**A. Гайды по журналам** (`/settings/journal-guides`)
- Аналог todo-list с rich-text.
- Для каждого журнала — список «гайд-задач»: задачи на чтение, объяснение, советы для новичка.
- Это **не для заполнения** журнала — это для onboarding'а.
- Drag-drop reorder, добавление, удаление, редактирование.
- Опциональный photo для иллюстрации шага гайда.
- Источник по умолчанию: `journal-filling-guides.ts.steps` (импортируется один раз при первом открытии настройки).

**B. Pipeline настройка** (`/settings/journal-pipelines`)
- ДЛЯ КАЖДОГО ЖУРНАЛА своя страница `/settings/journal-pipelines/<code>`.
- Дерево узлов pipeline с двумя типами: **pinned** (системные, нельзя удалить) и **custom** (админские).
- Pinned узлы автоматически создаются по `JournalSpec.fields` — каждое поле журнала = один pinned-шаг.
- Можно редактировать title/detail у pinned, можно делить (split → 2 узла, оба pinned, ссылка на тот же linkedFieldKey), но нельзя удалить.
- Custom узлы — полная свобода: добавить, удалить, скопировать, разделить, сделать вложенным.
- Reorder: drag-drop (или клавиатурный fallback с aria-roledescription="reorderable list").
- Иерархия: subtask → sub-subtask → ... (глубина не ограничена в схеме, в UI ограничить до 3 уровней первой версии чтобы не уходить в безумие).
- Per-узел флаги: `requirePhoto`, `requireComment`, `requireSignature` (последний — введи свою подпись текстом).
- Кнопка «Очистить всё» — удаляет ТОЛЬКО custom узлы, pinned остаются.
- Ниже редактора — **превью wizard'а** в текущем виде (как сотрудник его увидит). Live-update.

### P1.2 — DB Schema

Новые модели в `prisma/schema.prisma`:

```prisma
model JournalGuideTemplate {
  id             String    @id @default(cuid())
  organizationId String
  templateCode   String    // соответствует JournalTemplate.code
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  nodes          JournalGuideNode[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([organizationId, templateCode])
}

model JournalGuideNode {
  id           String   @id @default(cuid())
  templateId   String
  template     JournalGuideTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  parentId     String?
  parent       JournalGuideNode? @relation("guide_children", fields: [parentId], references: [id], onDelete: Cascade)
  children     JournalGuideNode[] @relation("guide_children")
  title        String
  detail       String?  @db.Text
  ordering     Float    // sortable, для drag-drop без reindexing
  photoUrl     String?  // optional illustrative photo

  @@index([templateId, parentId, ordering])
}

model JournalPipelineTemplate {
  id             String    @id @default(cuid())
  organizationId String
  templateCode   String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  nodes          JournalPipelineNode[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([organizationId, templateCode])
}

model JournalPipelineNode {
  id              String  @id @default(cuid())
  templateId      String
  template        JournalPipelineTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  parentId        String?
  parent          JournalPipelineNode? @relation("pipeline_children", fields: [parentId], references: [id], onDelete: Cascade)
  children        JournalPipelineNode[] @relation("pipeline_children")

  /// "pinned" = системно-обязательный, привязанный к колонке журнала.
  /// "custom" = добавлен админом, может быть удалён.
  kind            String   @default("custom")

  /// Только для pinned: ключ колонки в journal-spec.fields. Когда worker
  /// заполнит этот шаг, value пойдёт в JournalDocumentEntry.data[fieldKey].
  linkedFieldKey  String?

  title           String
  detail          String?  @db.Text
  hint            String?  @db.Text
  ordering        Float

  /// Фото-доказательство — обязательное / по желанию / не нужно.
  photoMode       String   @default("none")  // "none" | "optional" | "required"
  /// Текстовый комментарий обязателен на этом шаге.
  requireComment  Boolean  @default(false)
  /// Подпись текстом (worker введёт ФИО). Полезно для финальных шагов.
  requireSignature Boolean @default(false)

  @@index([templateId, parentId, ordering])
}
```

### P1.3 — API endpoints

```
GET    /api/settings/journal-pipelines/:code        — load tree
PATCH  /api/settings/journal-pipelines/:code/seed   — initial seed pinned from spec.fields
POST   /api/settings/journal-pipelines/:code/nodes  — create custom node
PATCH  /api/settings/journal-pipelines/:code/nodes/:id  — edit
PATCH  /api/settings/journal-pipelines/:code/nodes/:id/move  — reorder (parentId + ordering)
POST   /api/settings/journal-pipelines/:code/nodes/:id/split — split node (only pinned)
DELETE /api/settings/journal-pipelines/:code/nodes/:id  — delete (custom only)
POST   /api/settings/journal-pipelines/:code/clear-custom  — drop all custom nodes

GET    /api/settings/journal-guides/:code           — symmetric for guides
... etc
```

Все защищены `hasFullWorkspaceAccess`. Все мутации пишут AuditLog.

### P1.4 — Generic-adapter integration

`tasksflow-adapters/generic.ts.getTaskForm()` теперь:
1. Читает `JournalPipelineTemplate` для (orgId, templateCode).
2. Если есть — собирает pipeline из узлов, иерархия flatten в линейный список (с indent для UI).
3. Если нет — fallback на текущую логику (filling-guides.steps).
4. На каждом узле:
   - `requirePhoto = (photoMode === "required")` (legacy field)
   - Дополнительно передаём `photoMode`, `requireComment`, `requireSignature`, `linkedFieldKey`
5. Для pinned-узлов с `linkedFieldKey` — добавляем `field` из `JournalSpec.fields[linkedFieldKey]`.

`applyRemoteCompletion`:
1. Парсит `_pipeline.steps[]` из values.
2. Для каждого confirmed-step где есть `linkedFieldKey` + значение → пишет в `data[linkedFieldKey]`.
3. Это решает P0.1.

### P1.5 — Drag-drop UX

Используем `@dnd-kit/sortable` (популярный, accessible).

Структура UI:
```
┌── Pipeline для journal_X ──────────────┐
│                                         │
│  [+ Добавить шаг] [Очистить custom]    │
│                                         │
│  📌 1. Осмотри по описи     ⋮  [edit]  │  pinned
│       ↪ 1.1. Возьми журнал  ⋮  [edit]  │  custom subtask
│       ↪ 1.2. Сверь номера   ⋮  [edit]  │  custom subtask
│  📌 2. Найди дефекты         ⋮  [edit]  │  pinned
│  ✏  3. Сфоткай результат    ⋮  [edit]  │  custom
│  📌 4. Запиши в журнал       ⋮  [edit]  │  pinned
│                                         │
└─────────────────────────────────────────┘
```

Drag handle (⋮) на левом краю каждой строки. При drag — vertical insertion line показывает где упадёт. Между pinned узлами всегда можно вставить custom. Pinned можно перемещать друг относительно друга. При drop → PATCH `/move` с новым parentId/ordering.

### P1.6 — Pinned protection

В UI у pinned-узла:
- Корзина disabled / отсутствует
- Кнопка «Разделить» доступна (создаёт два pinned со ссылкой на тот же linkedFieldKey, разбитый title).
- Title/detail редактируемы.
- Иконка 📌 в углу.

В API:
- `DELETE` на pinned → 403.
- `clear-custom` → удаляет только `kind = "custom"`.

---

## P2 — Feature backlog (200-1000 фишек)

Источник: `LOOP-NEXT.md` секция «Feature backlog». Каждый цикл `/loop 10m`:
1. Открывает `LOOP-NEXT.md`.
2. Если есть незакрытые P0/P1 — делает их.
3. Иначе берёт top-3-5 из P2, делает.
4. После каждой группы коммитит, пушит, ждёт деплой, проверяет на проде, обновляет `LOOP-NEXT.md`.
5. Если идей в P2 < 50 — генерит ещё 10-30 идей-кандидатов в секции «Ideas brainstorm» (без реализации). Владелец потом промоутит идеи в реальный backlog.

**Категории фичей** (для systematic generation):
1. **UX-shortcuts** — горячие клавиши, quick-actions, batch-операции, undo
2. **Mobile/Mini App** — оффлайн-кеш, push-уведомления, быстрые шаблоны
3. **Manager-tools** — дашборд-виджеты, weekly digest, export
4. **Worker-tools** — voice-input, фото-distraction-free fill, autosave
5. **Compliance** — checklists, deadlines, score
6. **Integrations** — calendar, Slack/Telegram, 1C, Меркурий, Excel
7. **Reports** — graphs, custom queries, PDF formats, audit certificates
8. **Onboarding** — wizards, tutorials, sample data
9. **Performance** — query-cache, image lazy-loading, bundle-split
10. **A11y** — keyboard nav, screen-reader, contrast modes

**Anti-patterns** (НЕ делать в loop):
- Тривиальные refactor'ы которые не меняют поведение
- Расширение API без потребителя (YAGNI)
- Декоративные изменения CSS без user-value
- Дублирование функциональности под другим именем

---

## Loop Protocol

Каждая итерация `/loop 10m` (или manual продолжение):

1. **Read** `docs/PIPELINE-VISION.md` (этот файл) + `docs/LOOP-NEXT.md`.
2. **Pick** следующий пункт по приоритету:
   - Если P0 не пуст — берёт первый P0
   - Иначе если P1 не пуст — берёт первый P1
   - Иначе берёт top-3-5 из P2
3. **For UI tasks** — обязательно:
   - Открыть `https://lk.haccp-online.ru/docs/1` (логин test4/test8) или соответствующую страницу
   - Через playwright или WebFetch посмотреть как у них реализовано
   - Скопировать паттерн (с адаптацией под наш design-system)
4. **Implement** — следуя `superpowers` skills:
   - `wesetup-design` для UI
   - `karpathy-guidelines` для code quality
   - `superpowers:test-driven-development` для багов (write test → fix → verify)
   - `superpowers:systematic-debugging` для P0
5. **Verify**:
   - `npx tsc --noEmit --skipLibCheck` clean
   - Smoke-test endpoint вручную (curl или playwright)
6. **Commit** — русское сообщение, с упоминанием pinned bug ID или feature ID из `LOOP-NEXT.md`.
7. **Push** — `git push origin master`.
8. **Wait deploy** — polling SSH `cat .build-sha` пока не совпадёт с HEAD.
9. **Smoke prod** — `curl /login` 200 + если ROOT-доступ есть, проверить ключевую страницу.
10. **Update `LOOP-NEXT.md`**:
    - Помечает пункт DONE с git-sha и timestamp
    - Добавляет lessons-learned одной строкой если что-то нетривиальное
11. **Continue** — следующая итерация. Не вставать самостоятельно — только когда `/loop` сам fire'нет.

**STOP условия:**
- P0 + P1 + P2 все пустые
- P2 закрыто 1000 пунктов
- Owner type'ает что-нибудь в чате (loop сам остановится)
- 5 итераций подряд провалили (typecheck/build/deploy fail)

---

## External resources — haccp-online.ru competitor reference

Конкурент с готовыми UI-паттернами по большинству журналов. Каждая UI-задача в loop'е должна **сначала** посмотреть как у них реализовано.

**URL:** https://lk.haccp-online.ru/
**Логин страница:** https://lk.haccp-online.ru/docs/login
**Логин:** `test4`
**Пароль:** `test8`

(Креды публичные — раздаются сайтом бесплатно для демо. Можно класть в репо.)

**Как использовать в loop'е:**

Через MCP Playwright (доступен при запуске loop'а):

```javascript
mcp__plugin_playwright_playwright__browser_navigate({ url: "https://lk.haccp-online.ru/docs/login" })
mcp__plugin_playwright_playwright__browser_snapshot()  // see structure
mcp__plugin_playwright_playwright__browser_fill_form({ fields: [
  { ref: "<login input ref>", value: "test4" },
  { ref: "<password input ref>", value: "test8" }
]})
mcp__plugin_playwright_playwright__browser_click({ ref: "<submit button ref>" })
// после логина — навигация по конкретному журналу
mcp__plugin_playwright_playwright__browser_navigate({ url: "https://lk.haccp-online.ru/docs/glasscontroljournal" })
mcp__plugin_playwright_playwright__browser_snapshot()
mcp__plugin_playwright_playwright__browser_take_screenshot({ filename: "haccp-glass-control.png" })
```

Браузер сохраняет cookies на сессию — после логина все навигации работают как с авторизованного юзера.

**Список ключевых URL'ов:**
- `/docs/healthjournal` — Гигиенический журнал
- `/docs/cleaning1journal` — Журнал уборки
- `/docs/brakeryjournal` — Бракераж готовой продукции
- `/docs/glasscontroljournal` — Контроль стекла (сейчас наш P0)
- `/docs/healthjournal/doc/<id>/?id=<entryId>` — внутрь конкретного документа
- `/docs/healthjournal/doc/<id>/settings` — модалка настроек документа

---

## Constraints

1. **Не ломать существующее.** Каждый коммит должен оставлять прод green. Если break — откатить, разобраться, переделать.
2. **Не делать `git push --force`.** Не делать `git reset --hard` если есть несовершённые изменения.
3. **Не запускать `npx prisma migrate dev` локально без БД.** Только `npx prisma generate` + push в schema.prisma; миграция выполнится на проде (`prisma db push` в deploy.yml).
4. **Не записывать секреты в код или коммиты.**
5. **Memory user'а:** «Test on prod, not localhost» — тестируй через wesetup.ru напрямую (Playwright/curl), без spin-up dev-server.
6. **Memory user'а:** «No auto-loop / ScheduleWakeup» — `/loop` запускается только вручную владельцем. Если лимиты в loop'е кончились — стопаемся, не пытаемся возобновить.

---

## Success metrics

- **P0 closed:** уборщица заполняет glass_control через TasksFlow → данные в журнале есть, проверка РПН пройдёт.
- **P1 v1 ready:** владелец заходит на `/settings/journal-pipelines/glass_control`, видит дерево узлов, drag'ит, добавляет custom-шаг с фото — это реально влияет на форму у уборщицы.
- **P2 backlog:** 200+ фичей реализованы и помечены DONE.
- **Audit-log:** каждое изменение pipeline-template и каждое прохождение pipeline'а видно в `/settings/audit` с фильтрами и pretty-render'ом.

---

## Owner reaction expected

После каждой большой вехи (P0 closed, P1.x done, +50 features) — короткий отчёт в `LOOP-NEXT.md` секция «Owner notifications»: что сделано, что заметил во время работы, что предлагаешь приоритизировать дальше.
