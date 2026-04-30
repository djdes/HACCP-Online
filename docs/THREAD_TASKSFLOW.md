# Поток 2 — TasksFlow integration

> Этот файл — задание для одного из трёх параллельных чатов. Работаешь с репой **TasksFlow** (отдельной от WeSetup), а также с интеграционным слоем `src/lib/tasksflow-adapters/*` внутри WeSetup.

---

## Что такое TasksFlow

**TasksFlow** — отдельный микросервис задач/чек-листов, к которому WeSetup подключается через REST API. Работники получают свои задачи (например, «измерить температуру холодильника №3 в 14:00») в TasksFlow, а как только задача закрыта — TasksFlow дёргает WeSetup webhook, и WeSetup создаёт соответствующую запись в журнале (через адаптеры).

Это даёт:
- Сотрудник видит **один список задач на день**, а не 30 разных журналов.
- Manager в TasksFlow назначает повторяющиеся задачи (cron-like).
- WeSetup автоматически собирает evidence в журналы → готовая отчётность для РПН.

**Репо TasksFlow:** `https://github.com/djdes/TasksFlow.git` (в WeSetup репо подключена как remote `tasksflow`).
**Прод-API URL:** в env `TASKSFLOW_API_URL`, ключ в `TASKSFLOW_API_KEY`.
**WeSetup ↔ TasksFlow связки:** модели `TasksFlowIntegration`, `TasksFlowUserLink`, `TasksFlowTaskLink` в `prisma/schema.prisma`.

## Параллельная работа в три потока

Сейчас идут одновременно три чата:
- **Поток 1 — WeSetup core.** Дашборд, журналы, отчёты, settings, AI, billing — репа `origin` (HACCP-Online).
- **Поток 2 (этот) — TasksFlow integration.** Сама репа TasksFlow + адаптеры внутри WeSetup.
- **Поток 3 — Telegram Bot / Mini App.** Папки `src/app/mini`, `src/app/api/telegram`, `src/lib/telegram.ts` в HACCP-Online.

Конфликтов merge быть не должно — каждый поток работает в своих папках/репах.

## Зоны ответственности

### В репе TasksFlow (`origin` для этой репы)
Всё содержимое — backend задач, UI назначения, scheduler.

### В репе HACCP-Online (push через remote `tasksflow` будет ошибкой — пушить надо в `origin`!)
```
src/lib/tasksflow-adapters/                # все 30+ адаптеров «task → journal entry»
src/app/api/integrations/tasksflow/        # sync-users, sync-tasks, webhook
src/app/api/cron/tasksflow-escalations/    # эскалация просроченных
src/app/api/task-fill/                     # endpoint для HMAC-tokenized fill из TasksFlow
src/app/(dashboard)/settings/integrations/tasksflow/
src/app/task-fill/                         # public страница «выполнить задачу»
src/app/equipment-fill/                    # public страница «выполнить equipment-task»
docs/THREAD_TASKSFLOW.md                   # этот файл
```

## Бэклог фич для этого потока

### Приоритет 1 — реальные дыры в текущей интеграции

1. **Resilience всех адаптеров против `doc.config = {}` / null** (BUGFIX-002 уже частично пофикшен в трёх адаптерах, но 27 других не проверены) — пройтись по всем `src/lib/tasksflow-adapters/*.ts` и убедиться что `doc.config ?? {}` есть везде где читается config.
2. **Idempotency для webhook'а** — TasksFlow при retry'ах может прислать одно событие несколько раз. Сейчас это создаст дубль JournalEntry. Добавить unique constraint по `(taskFlowEventId, journalCode, date)` или хранить `processedEventIds` set.
3. **Auto-escalation cron — реалистичные thresholds** (F-048) — сейчас cron `tasksflow-escalations` ищет задачи старше N часов; вынести N в org-settings («через сколько часов эскалировать к руководителю»).
4. **Sync-users двусторонняя** — сейчас WeSetup → TasksFlow только. Добавить TasksFlow → WeSetup (когда manager в TF добавляет нового сотрудника, он появляется в WeSetup как pending invite).
5. **Health-check endpoint в TasksFlow** — `GET /health` который WeSetup пинговать раз в 5 минут и в `/settings/integrations/tasksflow` показывать «зелёный/жёлтый/красный».
6. **Retry-queue для webhook delivery** — если WeSetup упал, TasksFlow должен retry с exponential backoff (5min / 15min / 1h / 6h / суток). Сейчас один retry и всё.

### Приоритет 2 — новые адаптеры

7. **Адаптер для journal `inventory_count`** — задача «провести инвентаризацию холодильника» из TF создаёт document в hygiene-style grid.
8. **Адаптер для journal `incoming_inspection`** — приёмка товара от поставщика с фото накладной.
9. **Адаптер для journal `pest_control_log`** — обработка от грызунов/насекомых; задача в TF от подрядчика.
10. **Composite-задачи** — одна задача в TF создаёт записи сразу в нескольких журналах WeSetup (например, «утренний осмотр» = запись в medbook + hand_hygiene + uniform).

### Приоритет 3 — UX / dashboard в TasksFlow

11. **Calendar view для рекуррентных задач** — недельная сетка где видно «вот тут пробел, никто не назначен на пятницу 10:00 t°-check».
12. **Drag-and-drop переназначения** — Kanban-столбцы по сотрудникам, перетаскивание задач между ними.
13. **Mass-clone недели** — «скопировать понедельник как шаблон для всех будних дней».
14. **Photo-required toggle на task definition** — manager помечает задачу как «требует фото», без фото close = reject.
15. **Voice-note completion** — прикрепить голосовую запись (10s) к выполненной задаче, бот сделает транскрипт через Whisper.

### Приоритет 4 — техдолг

16. **Tests для адаптеров** — каждый адаптер должен иметь unit-тест с фикстурой реального TF-task payload.
17. **OpenAPI-спека для TasksFlow API** — сейчас только в коде. Сгенерить через zod-to-openapi или вручную.
18. **Rate-limit на webhook endpoint** — чтобы flood от TF не положил WeSetup БД.
19. **Структурированный лог в JSON** — чтобы можно было grep'ать по `eventId`, `taskId`, `orgId`.

## Правила деплоя

### TasksFlow (репа `tasksflow`)
1. Клонируй: `git clone https://github.com/djdes/TasksFlow.git ../TasksFlow` (отдельная директория, не внутри WeSetup).
2. Работай в той папке. После каждой фичи: `git add ...; git commit -m "<рус>"; git push origin master`.
3. Деплой TasksFlow — отдельный pipeline (см. README репы TasksFlow).

### HACCP-Online (адаптеры внутри WeSetup, репа `origin`)
1. Работаешь в `c:\www\Wesetup.ru` в файлах из «Зоны ответственности».
2. После каждой фичи: `git add src/lib/tasksflow-adapters/<file>; git commit -m "<рус>"; git push origin master`.
3. **Пуш делай в `origin`, НЕ в `tasksflow`!** Remote `tasksflow` смотрит на отдельную репу TasksFlow.
4. Между push'ами WeSetup жди deploy готов (`.build-sha == HEAD` на проде).

## Не делай

- Не правь `src/app/(dashboard)/*` за пределами `settings/integrations/tasksflow/` — это поток 1.
- Не правь `src/app/mini/*` или `src/lib/telegram.ts` — это поток 3.
- Не пушь содержимое HACCP-Online в remote `tasksflow` (это разные репы — будет конфликт истории).
- Не делай breaking changes в TasksFlow API без миграции в WeSetup адаптерах.
- Не force-push в master ни в одной из реп.
