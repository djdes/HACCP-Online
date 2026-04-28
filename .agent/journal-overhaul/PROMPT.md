# Journal Overhaul — Long-running autonomous loop

## Миссия

Привести каждый журнал WeSetup к единой логике «race-claim + одна задача в работе одновременно» с уважением к специфике каждого журнала по СанПиН/ХАССП. Демо завтра — менеджер должен показать живой сценарий, где сотрудник на телефоне берёт задание, оно блокируется для остальных, синхронизируется с TasksFlow.

Это long-running task. Один прогон `/loop` берёт **ОДИН** журнал, доводит его до definition-of-done, коммитит и пушит, обновляет `.agent/journal-overhaul/STATE.md`, и завершается. Следующий прогон возьмёт следующий журнал из STATE.

## Приоритет журналов (фиксированный)

1. `hygiene` — гигиена персонала
2. `cold_equipment_control` — температура холодильников
3. `climate_control` — климат-контроль
4. `incoming_control` — приёмка сырья
5. `finished_product` — бракераж готовой продукции
6. `cleaning` — генеральная уборка (**reference** — паттерн уже есть, но надо проверить и допилить)
7. `disinfectant_usage` — учёт дезсредств
8. `fryer_oil` — фритюрный жир
9. `med_books` — медицинские книжки
10. `staff_training` — обучение персонала

После 10 — открытый список. Берёшь следующий по `JournalCatalog.sortOrder` если не указано иное.

## Reference (читать в начале КАЖДОГО прогона)

```
.agent/journal-overhaul/STATE.md         — текущее состояние, что сделано, какой next
src/lib/cleaning-document.ts              — config-shape reference
src/lib/tasksflow-adapters/cleaning.ts    — TasksFlow mirror reference
src/components/journals/cleaning-document-client.tsx  — UI reference (claim button, "взято X", и др.)
src/lib/journal-obligations.ts            — claim/obligation модель
src/lib/journal-catalog.ts                — каталог шаблонов
prisma/schema.prisma                      — схема (Building, Room, JournalObligation, JournalDocument*)
src/app/api/cron/cleaning-control-digest/route.ts — daily digest pattern
.agent/journal-overhaul/PROMPT.md         — этот файл
```

## Контекстные ответы пользователя (закреплены)

1. **Приоритет:** список выше. После 10 — продолжать пока есть работа.
2. **Bi-directional с TasksFlow:** клейм в WeSetup → создаётся / обновляется TasksFlow-задача с тем же claim-state. Клейм в TasksFlow → синхронизируется обратно (через webhook или pull). Цель: «человек берёт задачу на ПК — она же тут же блокируется в Telegram и наоборот».
3. **PC + Telegram Mini App связаны через БД** — клейм пишется в `JournalObligation` (или эквивалент), оба клиента читают один источник.
4. **Schema free** — Prisma миграции разрешены. Ограничение: НИКОГДА `prisma db push --force` без `mysqldump`/`pg_dump`. Используй обычный `prisma db push` (deploy-flow в `.github/workflows/deploy.yml` уже его дёргает после safety-net'ов; новые поля прокидываются автоматически).
5. **Источник истины:** ты сам гуглишь СанПиН/ХАССП по каждому журналу через `WebFetch` / `WebSearch`. Список конкретных СанПиН/ХАССП-документов и ГОСТов — ниже в per-journal секциях.
6. **«Не надо заполнять» через `allowNoEvents`** — выставь правильные defaults per-journal (см. таблицу).
7. **Демо:** менеджер заходит как сотрудники через «Войти как» (impersonation, ROOT-функция) — не забывай тестировать с employee POV.

## Definition of Done (per journal)

Каждый журнал считается «сделанным» когда:

1. **Race-claim flow работает.** В мини-аппе и в дашборде:
   - Сотрудник видит список доступных задач (granularity per-journal — см. ниже).
   - Кнопка «Взять» создаёт claim в `JournalObligation` (status=`in_progress`, `claimedById=userId`, `claimedAt=now`).
   - Все остальные клиенты, у которых открыт тот же экран, через `router.refresh()` или polling видят `«Взято: <Имя>»` (badge). Кнопка «Взять» disabled.
2. **One-active-task rule.** Пока у пользователя есть obligation со статусом `in_progress` (claimedById=userId), все остальные кнопки «Взять» для него — disabled с tooltip «Сначала заверши <название>». Серверная проверка в API endpoint claim.
3. **Журнал-специфические поля заполняются корректно.** См. per-journal секции — какие поля, какая валидация.
4. **`allowNoEvents` defaults** проставлены per-journal в `JournalScopeSetting` или эквиваленте (см. `/api/settings/journal-scope/<code>` PATCH).
5. **TasksFlow mirror работает (или подготовлен фундамент).**
   - При claim: `POST` в TasksFlow API (`tasksflow-adapters/<journal>.ts` — расширить existing): создать или обновить task, выставить `claimedByTasksFlowUserId`.
   - На webhook от TasksFlow (existing infra в `src/app/api/integrations/tasksflow/webhooks/`): обновить WeSetup `JournalObligation`.
   - Если TasksFlow integration отключена для org — fallback на WeSetup-only, без ошибок.
6. **Mini App страница** `/mini/journals/<code>/...` показывает:
   - Список доступных задач для текущего пользователя.
   - Mine-задачи сверху со статусом «В работе».
   - Завершить → переход к следующей доступной (или toast «Все задачи выполнены!»).
7. **Dashboard страница** `/journals/<code>` для менеджера показывает:
   - Прогресс bar (взято / всего / завершено).
   - Кто что взял (Live).
   - Anomaly hints (если есть).
8. **Type-check `npx tsc --noEmit --skipLibCheck`** не вводит **новых** ошибок (51 pre-existing про Building/Room/journalPeriods — игнорь).
9. **Build не сломан.** `npm run build` проходит. (Запускать только если есть подозрение — иначе медленно.)
10. **Commit в стиле прошлых:** `feat(journal-<code>): race-claim + one-active-task + TasksFlow mirror — <короткий summary>`. На русском. Push в `master`.
11. **STATE.md обновлён** — журнал помечен как `done`, добавлены заметки/edge-cases, next выставлен на следующий по приоритету.

## Универсальная структура journal-данных

```ts
// JournalObligation (existing — расширить если надо)
{
  id, organizationId, templateId, journalDocumentId?,
  // granularity:
  scopeKey: string,           // например "room:<roomId>", "fridge:<equipmentId>", "user:<userId>"
  scopeLabel: string,         // human-readable («Зона 2 — Холодный цех»)
  date: Date,                 // целевая дата задачи
  // claim state:
  status: 'pending' | 'in_progress' | 'done' | 'skipped',
  claimedById: string | null,
  claimedByName: string | null,
  claimedAt: Date | null,
  completedAt: Date | null,
  // skip reason если allowNoEvents:
  skippedReason: string | null,
  // tasksflow link:
  tasksFlowTaskId: string | null,
  // payload — entry data когда задача завершается:
  entryId: string | null,     // FK на JournalDocumentEntry или JournalEntry
}
```

Если `JournalObligation` не существует — создать миграцию. Если существует — расширить нужными полями.

## Per-journal спецификации

### 1. `hygiene` — Гигиенический журнал

**Реальная жизнь:** перед началом смены каждый сотрудник проверяет состояние здоровья (нет ли температуры, кашля, открытых ран на руках). Старший фиксирует «допущен / не допущен». Один документ на 15 дней. Каждый сотрудник × каждый день = ячейка.

**СанПиН:** СП 2.3/2.4.3590-20 п. 2.22, обязателен. ХАССП-критическая контрольная точка.

**Granularity:** Per-employee per-day. На день N в этом journal-document должно быть `expectedRoster` строк (один на сотрудника).

**Race-claim:** Не нужен в классическом виде — журнал заполняется ОТВЕТСТВЕННЫМ за смену (head_chef/manager) единым актом, не по очереди. НО: чтобы вписаться в общий паттерн — task на «провести гигиенический осмотр смены» создаётся утром, claim-ает один человек (управляющий или шеф), он проходит по всем сотрудникам и фиксирует.

**allowNoEvents:** **NO** (ежедневно обязательно).

**Anomaly hint:** температура у сотрудника > 37 → авто-CAPA + блок «не допущен» + Telegram-нотификация менеджеру.

**Mini App:** показать форму-таблицу (employee × отметка), сохранить весь блок одной кнопкой.

**Dashboard:** read-only matrix последних 15 дней с цветными ячейками.

**TasksFlow mirror:** одна task в день «Гигиенический осмотр смены», completed когда все строки заполнены.

---

### 2. `cold_equipment_control` — Температура холодильников

**Реальная жизнь:** утром и вечером (2× в сутки) ответственный измеряет температуру каждого холодильного агрегата. Запись в журнал. Если выходит за допуск → ремонт + утилизация продукции + CAPA.

**СанПиН:** СП 2.3/2.4.3590-20 п. 2.7. ХАССП ККТ-1.

**Granularity:** Per-equipment per-shift (per fridge × утро/вечер).

**Race-claim:** список «Холодильник 1 — утро», «Холодильник 1 — вечер», «Холодильник 2 — утро», ... Кто первый взял — тот измеряет. Остальные холодильники — другие сотрудники могут брать параллельно.

**allowNoEvents:** **NO**.

**Поля entry:** `temperature: number`, `humidity?: number`, `equipmentId: string`, `shift: 'morning'|'evening'`, `photo?` (если требуется), `correctiveAction?` (если out-of-range).

**Validation:** если `temperature` вне `Equipment.tempMin..tempMax` → требовать `correctiveAction`, авто-создавать CAPA, Telegram-нотификация.

**Anomaly hint:** уже есть в `/api/dashboard/anomalies` — расширить.

**Mini App:** список карточек с фотками холодильников + статус (взято/доступно), при выборе — простая форма.

**Dashboard:** график температур за 7 дней с red-zones, список агрегатов с alert-ами.

**TasksFlow mirror:** task на каждое (fridge × shift).

---

### 3. `climate_control` — Климат-контроль

**Реальная жизнь:** для холодных цехов / складов готовой продукции — измерение температуры воздуха и влажности. 1-2 раза в день. ВКВ (внутренняя приточная вентиляция).

**СанПиН:** СП 2.3/2.4.3590-20 п. 2.13.

**Granularity:** Per-area per-shift.

**Race-claim:** Зоны (areas) × смены. Кто первый взял зону на смену — измеряет.

**allowNoEvents:** **NO** (ежедневно).

**Поля entry:** `temperature`, `humidity`, `areaId`, `shift`, `correctiveAction?`.

**Mini App / Dashboard:** аналогично cold_equipment.

**TasksFlow mirror:** task на каждую (area × shift).

---

### 4. `incoming_control` — Приёмка сырья

**Реальная жизнь:** при поставке сырья — проверить документы, целостность упаковки, температуру (для скоропорта), маркировку, срок годности. Запись по каждой партии.

**СанПиН:** СП 2.3/2.4.3590-20 п. 2.10. ТР ТС 021/2011.

**Granularity:** Per-delivery (event-driven).

**Race-claim:** Event-based — менеджер создаёт задачу «Ожидается приёмка от <поставщик>» (или открыт обобщённый «Приём сырья сегодня» pool). Кто принимает — claim'ает, заполняет, completed.

**allowNoEvents:** **YES** — варианты причин: «Поставок не было», «Поставщик не приехал», «Доставка перенесена».

**Поля entry:** `supplier`, `productName`, `batchNumber?`, `expirationDate`, `temperature?`, `quantity`, `unit`, `accepted: boolean`, `rejectionReason?`, `photoMarking?`.

**Mini App:** "+ Принять поставку" большая кнопка. Скан штрих-кода (если есть). Форма по шагам.

**Dashboard:** список приёмок за день/неделю, таблица.

**TasksFlow mirror:** task создаётся **по факту приёмки**, не на день вперёд.

---

### 5. `finished_product` — Бракераж готовой продукции

**Реальная жизнь:** перед выдачей блюд — органолептическая проверка (вкус, цвет, температура подачи), запись в бракеражный журнал. Каждое блюдо/партия.

**СанПиН:** СП 2.3/2.4.3590-20 п. 2.18, ХАССП ККТ-2.

**Granularity:** Per-batch per-meal.

**Race-claim:** Event-based — комиссия из 2-3 человек по графику. Один член комиссии берёт «Бракераж завтрака», заполняет за всех. Комиссия = list users.

**allowNoEvents:** **NO** в дни работы; **YES** в санитарные дни / выходные.

**Поля entry:** `dish`, `batchNumber?`, `appearanceOk: boolean`, `tasteOk: boolean`, `temperature?`, `commissionMembers: string[]`, `correctiveAction?`, `photoFinishedDish?`.

**Mini App:** комиссия = chip-list сотрудников с галочками; форма.

**Dashboard:** список с фильтром по дню/блюду.

**TasksFlow mirror:** task «Бракераж <завтрак/обед/ужин>».

---

### 6. `cleaning` — Уборка (REFERENCE — уже работает; проверить + допилить)

**Реальная жизнь:** ежедневная уборка помещений по графику. Зоны: горячий цех, холодный цех, склад, санузлы, и т.д. Контроль качества — отдельный сотрудник.

**СанПиН:** СП 2.3/2.4.3590-20 п. 2.16.

**Granularity:** Per-room per-day для уборки + per-room per-day для контроля.

**Race-claim:** УЖЕ РЕАЛИЗОВАН.

**allowNoEvents:** **YES** (выходные, санитарные дни, помещение не использовалось).

**Что доделать в reference:**
- Проверить, что мини-апп работает: `/mini/journals/cleaning/...`.
- Проверить one-active-task rule.
- Проверить, что TasksFlow синхронизация двусторонняя (может быть только outbound сейчас).
- Привести dashboard-страницу к стилю design-system (hero + cards).

---

### 7. `disinfectant_usage` — Дезсредства

**Реальная жизнь:** учёт расхода дезсредств: дата, количество, концентрация, кто разводил. Журнал чтобы инспектор увидел, что обработка реально велась.

**СанПиН:** СП 3.5.1378-03.

**Granularity:** Per-event (когда разводят раствор).

**Race-claim:** Event-based — кто разводит, тот и записывает.

**allowNoEvents:** **NO** (ежедневно при работе).

**Поля entry:** `disinfectantName`, `concentration`, `volumeLiters`, `purpose` (для какой зоны/оборудования), `expirationOfMix` (срок годности рабочего раствора), `preparedBy`.

**Mini App:** форма «Развёл дезраствор» — кнопка-+.

**TasksFlow mirror:** task `«Учёт дезсредств за <день>»`, может closed автоматически когда первая запись за день.

---

### 8. `fryer_oil` — Фритюрный жир

**Реальная жизнь:** контроль качества масла во фритюре. Замер каждый день: температура, цвет, тест на полярные соединения (если есть прибор). Замена при превышении.

**СанПиН:** СП 2.3/2.4.3590-20.

**Granularity:** Per-fryer per-day (обычно один-два фритюра в кафе).

**Race-claim:** Per-fryer per-day claim.

**allowNoEvents:** **YES** (если фритюр сегодня не использовали).

**Поля entry:** `fryerEquipmentId`, `temperatureC`, `polarCompoundsPercent?`, `colorAcceptable: boolean`, `replaced: boolean`, `replacedReason?`.

**Validation:** если polar > 25% или цвет тёмный → требовать `replaced=true`.

---

### 9. `med_books` — Медицинские книжки

**Реальная жизнь:** учёт медкнижек сотрудников. Срок годности (обычно 1 год). Прививки. Когда срок истекает — нотификация.

**СанПиН:** Приказ Минздрава 402н.

**Granularity:** Per-employee (не дневной — годовой).

**Race-claim:** Не релевантен (это event-management, а не daily-task). HR/manager вводит данные при поступлении сотрудника + при обновлении медкнижки.

**Что нужно:**
- Список сотрудников с датой следующей плановой медкомиссии.
- Цветовая индикация (зелёный — OK; жёлтый — < 30 дней; красный — просрочена).
- Auto-CAPA при просрочке + Telegram-нотификация менеджеру.
- TasksFlow task в TasksFlow на «Обновить медкнижку <ФИО>» за 14 дней до истечения.

**allowNoEvents:** не применимо (это master-data, а не daily-event).

---

### 10. `staff_training` — Обучение персонала

**Реальная жизнь:** при приёме на работу + ежегодно — гигиеническое обучение, инструктажи (вводный, на рабочем месте). Запись о проведении: дата, тема, кто проводил, кто прошёл, подпись.

**СанПиН:** СП 2.3/2.4.3590-20 п. 2.4, Приказ Минздрава 229.

**Granularity:** Per-event (когда проводят инструктаж).

**Race-claim:** Менеджер/инструктор создаёт «Инструктаж по гигиене 2026-04-30», claim-ает, заполняет (топик, прошедшие сотрудники = чек-лист), завершает.

**allowNoEvents:** не применимо (event-driven).

**Поля entry:** `trainingType` (вводный / повторный / целевой / гигиеническое обучение), `topic`, `instructorId`, `trainees: string[]`, `signaturesPhoto?`, `dateOfTraining`.

**Auto-reminder:** через год после последнего обучения сотрудника — авто-создание задачи.

---

## TasksFlow Mirror Protocol (общее)

### Outbound (WeSetup → TasksFlow):

При claim в WeSetup:
```ts
import { tasksFlowFetch } from "@/lib/tasksflow-adapters/client"; // если нет — создать
await tasksFlowFetch(integration, "POST", `/api/tasks/${tfTaskId}/claim`, {
  workerId: tfUserId, // из TasksFlowUserLink.tasksFlowUserId
});
```

При completion:
```ts
await tasksFlowFetch(integration, "POST", `/api/tasks/${tfTaskId}/complete`);
```

При **создании obligation** (если task ещё не существует в TasksFlow):
```ts
const tfTask = await tasksFlowFetch(integration, "POST", "/api/tasks", {
  title, description, dueDate, scope, weSetupObligationId,
});
// Сохранить tfTask.id в JournalObligation.tasksFlowTaskId.
```

### Inbound (TasksFlow → WeSetup) via webhook:

Endpoint: `/api/integrations/tasksflow/webhooks/route.ts` (existing). Handle events:
- `task.claimed` → найти `JournalObligation` по `tasksFlowTaskId`, выставить `claimedById=mappedWeSetupUserId`, `status=in_progress`, `claimedAt=now`.
- `task.completed` → выставить `status=done`, `completedAt=now`.

Если webhook integration не настроена — добавь polling-cron `tasksflow-claim-sync` каждые 60 секунд (existing patterns в `/api/cron/`).

### Если TasksFlow выключен у org — graceful degrade:

```ts
const tfIntegration = await db.tasksFlowIntegration.findFirst({ where: { organizationId, enabled: true } });
if (tfIntegration) {
  try { await mirrorClaim(tfIntegration, obligation); }
  catch (e) { console.error("[tasksflow-mirror]", e); /* не блокирует claim в WeSetup */ }
}
```

---

## Mini App scope

Базовая навигация — `src/app/mini/journals/[code]/...`. Нужно:
1. **List page** `/mini/journals/<code>/page.tsx`:
   - Hero: название журнала, текущая дата, прогресс (выполнено/всего сегодня).
   - Список карточек obligations:
     - Доступные («Взять» button).
     - Mine in-progress (вверху, со статусом «В работе»).
     - Взятые другими («Иванов работает», disabled).
     - Завершённые (collapsed).
   - Floating bottom-bar: «Сегодня без событий» если `allowNoEvents=true` — открывает модалку с причинами.
2. **Claim page** `/mini/journals/<code>/<obligationId>/page.tsx`:
   - Форма со специфичными для журнала полями.
   - Кнопка «Завершить» → POST → redirect обратно на list, с автоматическим переходом к следующей доступной если есть.

Использовать существующий `mini-shell` layout. Кнопки — стиль design-system (`bg-[#5566f6]` primary, large h-14 для тача).

---

## Dashboard scope

`src/app/(dashboard)/journals/<code>/page.tsx` или `<code>/documents/<docId>/page.tsx` — для каждого журнала своя страница. Что ВСЕГДА должно быть:

1. Hero (dark indigo, design-system).
2. Stat-pills: Завершено сегодня / Взято в работу / Доступно / Просрочено.
3. Live-таблица obligations с фильтром по статусу.
4. Кнопка «Создать задачу вручную» для менеджера.
5. Кнопка «Заполнить за день» (impersonate-style — менеджер заполняет за всех если employees физически отсутствуют).
6. Anomaly section если для этого журнала есть.

---

## Verification Protocol (после каждого журнала)

1. **TS-check:**
   ```bash
   npx tsc --noEmit --skipLibCheck 2>&1 | grep -v "building\|room\|journalPeriods\|employeeJoinToken" | head -20
   ```
   Если новые ошибки — фикси перед коммитом.

2. **Lint quick:** не запускай весь `npm run lint` — слишком долго. Просто eslint на изменённых файлах если возможно, иначе пропускай.

3. **Проверка API smoke:** после push'а и auto-deploy'а (~3 мин) — `curl https://wesetup.ru/api/journals/<code> -H "Cookie: ..."` если есть валидные cookies. Если нет — пропускай этот шаг.

4. **Playwright login-as-employee:** опционально, если есть время. Login на wesetup.ru как ROOT, нажать «Войти как» в org, открыть `/mini/journals/<code>`, попробовать claim, выйти и зайти под другим employee — увидеть «Взято».

5. **STATE.md обновляется** в КАЖДОМ цикле, даже если работа не завершена. См. формат ниже.

---

## STATE.md формат

```markdown
# Journal Overhaul State

## Last updated: 2026-04-29 03:14 UTC

## Done
- cleaning — reference, проверен+допилен. Commit abc123.
- hygiene — race-claim+TF mirror+mini-app. Commit def456.

## In progress
- cold_equipment_control — race-claim done, TF mirror в процессе.
  Next: webhook handler в /api/integrations/tasksflow/webhooks/.

## Next (priority order)
- climate_control
- incoming_control
- finished_product
- disinfectant_usage
- fryer_oil
- med_books
- staff_training

## Blockers
- (none)

## Notes / edge cases
- В hygiene заметил: `getEligibleEmployeesForJournal` фильтрует по
  ACL — если no acl rows, всё всем разрешено. ОК для cleaning, но
  для hygiene должны быть только cooks/waiters в строках. Учёл.
- TasksFlow API endpoint /api/tasks/.../claim — проверил existing
  integration в src/lib/tasksflow-adapters/cleaning.ts:148. Шаблон
  применим всем.

## Changelog
- 2026-04-29 03:14 — стартовал hygiene.
- 2026-04-29 04:02 — hygiene done, commit def456.
```

---

## Демо-сценарий (целевой workflow для завтра)

**Действующие лица:**
- Ольга — менеджер (управляющий).
- Иван — повар.
- Пётр — повар.

**Сцена 1 (на ПК у менеджера):**
1. Ольга открывает дашборд https://wesetup.ru/dashboard.
2. Видит: compliance ring 60%, anomaly card («Иванов 5 дней копирует одинаковую температуру»), close-day-card («Сейчас 7 журналов без записей»).
3. Жмёт «Закрыть день одним кликом» — копируются rutine entries для journals где сегодня пусто.
4. Открывает /journals/cold_equipment_control — видит 4 фридж-задачи на утро, никто ещё не взял.

**Сцена 2 (на телефоне у Ивана):**
5. Иван открывает Mini App в Telegram.
6. Видит главный экран: «Сегодня нужно: 4 задачи, 2 от вас». Карточки журналов.
7. Нажимает «Холодильники — утро» → видит 4 холодильника, все «Доступно».
8. Берёт «Холодильник 1 — утро» → claim → форма с полями (температура, фото).
9. Вводит 2°C, делает фото, «Завершить».
10. После завершения — авто-переход обратно к списку. Иван видит ещё 3 холодильника свободны, но дальше не идёт — переключается на Гигиену.

**Сцена 3 (на телефоне у Петра):**
11. Пётр открывает Mini App. Тоже видит /journals/cold_equipment_control.
12. Холодильник 1 — «Взято Иваном ✓» (зелёная галочка, потому что Иван завершил).
13. Холодильники 2-4 — «Доступно».
14. Пётр берёт «Холодильник 2». Иван (если в этот момент тоже смотрит) видит «Взято Петром».
15. Пётр пытается взять «Холодильник 3» — кнопка disabled, tooltip «Сначала заверши Холодильник 2».

**Сцена 4 (в TasksFlow):**
16. Ольга открывает второе окно — TasksFlow дашборд.
17. Видит: задача «Холодильник 1 — утро» — completed (Иван). Задача «Холодильник 2 — утро» — claimed (Пётр).
18. Это автоматически зеркалится через TasksFlow integration.

**Сцена 5 (anomaly):**
19. Иван берёт «Холодильник 4», вводит температуру `+12°C` (out of range).
20. Form требует `correctiveAction` — Иван пишет «Перепроверил термостат, выставил 4°C, закрыл дверь».
21. Auto-CAPA создаётся, Ольга получает Telegram-нотификацию через 30 сек.
22. На дашборде у Ольги anomaly-card обновляется в реальном времени.

**Сцена 6 (рапорт):**
23. Ольга в конце смены жмёт «Закрыть день» → все daily-journals финализируются.
24. Compliance ring → 100%.

---

## Loop discipline

Каждый прогон `/loop`:
1. Прочитай `.agent/journal-overhaul/STATE.md`.
2. Возьми `In progress` если он есть, иначе первый из `Next`.
3. Сделай ОДНУ задачу до конца (или один логический подэтап если задача на несколько часов).
4. Commit + push.
5. Обнови STATE.md.
6. Завершись.

При следующем фиринге `/loop` — context fresh, читаешь STATE.md заново и продолжаешь.

## Безопасность

- НИКОГДА `prisma migrate reset` или `db push --force`.
- НИКОГДА не удалять данные в seed-скриптах без backup'а.
- НИКОГДА `git push --force` на master.
- При schema-изменениях: `npx prisma db push` без флагов; deploy-flow сам сделает на проде через GH Actions, прошёл через `npm run prisma-safety`-pattern если он есть.
- Если git status показывает unstaged migrations — закомить их перед continue, никогда не откатывать.

## Коммиты — стиль

```
feat(journal-<code>): <короткое описание> [<scope>]

<тело>
- что сделано (race-claim/one-task/tf-mirror/mini-app/dashboard/anomaly).
- ссылки на схему / endpoints.
- что НЕ доделано (если делали split).
```

На русском. Branch `master`. Push сразу.

## Команда для запуска

```
/loop
```

Цикл сам прочитает этот файл и STATE.md и продолжит работу. Если /loop с интервалом не задан — система сама выберет ритм. Если хочется конкретный — `/loop 30m` или `/loop 1h`.
