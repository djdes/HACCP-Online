# План: pf-batch-2026-08-29 / plan-2

Планировщик: Fable (только план, код не менялся).
Дата: 2026-08-29. Исполнитель: Opus.

Перед началом работ исполнителю ОБЯЗАТЕЛЬНО:
- прочитать `CLAUDE.md` (UX-принципы 1–7, особенно п. 6 про ConfirmDialog и п. 7 про WhatsNewModal);
- invoke skill `design-system` (wesetup-design) перед правкой любого `.tsx`;
- задачи A и B — независимы по коду, но обе трогают онбординг; делать в порядке A → B (A создаёт shared-хелпер, B на него не завязан, но конфликтов по файлам меньше).

---

## Задача A. Карточка «Начальная настройка» должна исчезать с дашборда

### Диагноз (проверено по коду)

1. `/dashboard` рендерит `<QuickStartCard organizationId userId />` (compact-режим) —
   `src/app/(dashboard)/dashboard/page.tsx:261-266`.
2. `src/components/dashboard/quick-start-card.tsx` строит массив из **16 items**
   (строки 161–356: email-verify, company, positions, users, areas, equipment,
   products, journals, responsibles, pipelines, checklists, documents, tasksflow,
   telegram, auto-journals, compliance, schedule) и скрывает карточку только когда
   ВСЕ non-info items = `done` (строки 365–372):
   ```ts
   if (mode === "compact" && completed >= totalRequired && blocking === 0 &&
       items.every((i) => i.status === "done" || i.status === "info")) return null;
   ```
   Прогресс `71%` = `Math.round(completed / totalRequired * 100)`
   (`quick-start-card-client.tsx:117`).
3. `/settings/onboarding` (`src/app/(dashboard)/settings/onboarding/page.tsx`)
   **вообще не использует** QuickStartCard. Он строит СВОИ 3 этапа (строки 141–163)
   из СВОИХ условий (строки 81–137):
   - Этап 1 «Объект»: `buildingsItem` (`db.building` > 0 и `db.room` > 0) + `equipmentItem` (`db.equipment` ≥ 1);
   - Этап 2 «Команда»: `positionsItem` (`db.jobPosition` ≥ 1) + `usersItem` (активных ≥ 4 = complete; 2–3 = partial; <2 = empty);
   - Этап 3 «Журналы»: `journalsSetItem` (включён хотя бы один шаблон: `activeTemplates` минус `disabledJournalCodes` > 0).
   Этап complete = `items.every(state === "complete")` (строки 165–169), `allDone = firstActiveIdx === -1` (171).
   Финальный блок «Документы уже созданы (N активн.)» — `OnboardingFinishCta`
   с `activeDocumentsCount` (204).
4. Два набора условий никак не связаны → онбординг говорит «готово», дашборд — «71%».
   Более того, они расходятся даже по модели данных: quick-start считает «Цеха» по
   `db.area` (`quick-start-card.tsx:74`), а онбординг — по `db.building`/`db.room`
   (`onboarding/page.tsx:58-59`).
5. `mode="full"` у QuickStartCard — **мёртвый код**: единственное использование
   компонента — dashboard/page.tsx без `mode` (проверено grep'ом по всему `src`).
   `QuickStartCardFull` из `quick-start-card-client.tsx:221+` никем больше не
   импортируется.

### Решение: один источник правды

**Шаг A1. Новый файл `src/lib/onboarding-core-status.ts`.**

Вынести туда ВЕСЬ расчёт из `onboarding/page.tsx:40-171` (Promise.all + условия item'ов + статусы этапов), без JSX и без иконок:

```ts
export type CoreItemState = "complete" | "partial" | "empty";

export type CoreSetupStatus = {
  buildings: { buildingsCount: number; roomsCount: number; state: CoreItemState };
  equipment: { count: number; state: CoreItemState };
  positions: { count: number; state: CoreItemState };
  users:     { count: number; state: CoreItemState };
  journals:  { enabledCount: number; state: CoreItemState };
  /** Активных JournalDocument (status: "active"). */
  activeDocumentsCount: number;
  /** Все три этапа (объект/команда/журналы) complete. */
  coreComplete: boolean;
  /** coreComplete И документы созданы — «настройка закончена». */
  setupFinished: boolean;
};

export async function getCoreSetupStatus(organizationId: string): Promise<CoreSetupStatus>
```

Условия перенести **дословно** из onboarding/page.tsx (включая пороги: users ≥ 4 =
complete, 2–3 = partial; buildings > 0 && rooms > 0; equipment ≥ 1; positions ≥ 1;
enabledTemplates > 0). `setupFinished = coreComplete && activeDocumentsCount >= 1` —
ровно то, чего просит владелец: три этапа + документы созданы.

**Шаг A2. `src/app/(dashboard)/settings/onboarding/page.tsx` переводится на хелпер.**

Удалить локальный Promise.all (строки 40–77) и вычисление state'ов, вызывать
`getCoreSetupStatus(organizationId)`; item'ы (`SetupItem` с иконками, href, metric)
собирать из полей результата — иконки и лейблы остаются в странице, состояния берутся
из хелпера. `finishReady = status.coreComplete`, `activeDocumentsCount` — оттуда же.
Визуально страница не меняется ни на пиксель — это критерий (см. приёмку).

**Шаг A3. `src/components/dashboard/quick-start-card.tsx` — переписать на хелпер.**

- Удалить весь Promise.all из 15 запросов (строки 38–153) и массив 16 items (161–356),
  `BLOCKING_IDS`/`isBlocking` (392–401), параметр `mode` и ветку `mode === "full"`
  (374–382).
- Новый код: `const status = await getCoreSetupStatus(organizationId);
  if (status.setupFinished) return null;` — и рендер `QuickStartCardCompact` с
  item'ами, собранными из тех же 5 core-пунктов + пункт «Документы на текущий период»
  (`status: activeDocumentsCount >= 1 ? "done" : "empty"`, `href: "/settings/onboarding"`).
  Итого 6 карточек-пунктов вместо 16; проценты в compact-клиенте начнут совпадать со
  страницей онбординга (0–6 из 6). `userId`-проп и email-verify пункт из compact-карточки
  убрать (подтверждение почты живёт в `/settings#email-verify` и в advanced — не
  «начальная настройка»); соответственно убрать проп `userId` в
  `dashboard/page.tsx:264`.
- В `quick-start-card-client.tsx` удалить экспорт `QuickStartCardFull` (строки 221+)
  и всё, что нужно только ему. Типы `QuickStartItem`/иконки оставить — их использует
  compact. Если compact где-то показывает category-лейблы advanced — почистить.
- Ссылка большой кнопки compact-карточки остаётся `/settings/onboarding`.

Почему так, а не «добавить флажок в старую формулу»: CLAUDE.md UX-принцип 5
(«чистая модель данных → чистый UX») и главное требование задачи — один источник
правды. Любое дублирование условий снова разъедется. Advanced-пункты (products,
pipelines, checklists, tasksflow, telegram, auto-journals, compliance, schedule)
никуда не пропадают — они живут на `/settings/onboarding/advanced`
(`src/app/(dashboard)/settings/onboarding/advanced/page.tsx`, своя логика, не трогаем).

**Шаг A4. Что НЕ трогаем (проверено):**

- `(dashboard)/layout.tsx:122` — `hasFullWorkspaceAccess` там для
  `needsProfileCompletion` (анкета телефона/названия), к карточке отношения не имеет.
- `(dashboard)/dashboard/page.tsx:110` — redirect не-admin'ов, не зависит от карточки.
- Условие рендера карточки `hasFullWorkspaceAccess(session.user)` в
  dashboard/page.tsx:261 оставить как есть.
- `/settings/onboarding/advanced` — не трогаем (там свои 17 count'ов и свои PhaseCard).

**Шаг A5. WhatsNew (CLAUDE.md, принцип 7).** После деплоя A+B обновить
`src/lib/whats-new-notes.ts`: `LATEST_NOTES_BUILD_SHA` (сейчас `1cf6cc25`) → sha
коммита, пункт вида «Карточка настройки на дашборде теперь исчезает, когда пройдены
3 шага быстрого старта и созданы документы».

### Критерии приёмки A

- AC-A1: `npx tsc --noEmit --skipLibCheck` и `npm run lint` — чисто.
- AC-A2: у организации, где на `/settings/onboarding` все три этапа «ГОТОВО» и
  `activeDocumentsCount >= 1`, на `/dashboard` карточка «Начальная настройка»
  отсутствует (проверка взглядом или seed-организацией).
- AC-A3: у свежей организации (0 сотрудников) карточка на `/dashboard` видна и
  показывает прогресс из 6 пунктов, совпадающий по состояниям с
  `/settings/onboarding`.
- AC-A4: `/settings/onboarding` рендерится идентично прежнему (3 этапа, те же
  счётчики, тот же CTA).
- AC-A5: `grep -rn "QuickStartCardFull\|mode=\"full\"" src` — пусто.
- AC-A6: условия готовности этапов существуют в кодовой базе ровно в одном месте —
  `src/lib/onboarding-core-status.ts` (grep по `>= 4`-порогу пользователей должен
  находить его только там и в advanced-странице, у которой своя шкала).

### Риски A

- Порог `users >= 4 = complete` перенесён как есть; если у владельца 2–3 сотрудника,
  этап «Команда» не complete и карточка останется — но это ровно поведение
  `/settings/onboarding`, т.е. согласованно. Не «улучшать» порог молча.
- `db.area` vs `db.building`: compact-карточка после правки начнёт считать по
  building/room (как онбординг). У органзаций со старыми `Area` без `Building`
  пункт может «покраснеть» на дашборде — но он покраснеет так же, как на
  `/settings/onboarding`, т.е. рассинхрон исчезает, а не появляется. Упомянуть в
  коммит-сообщении.
- Не забыть, что onboarding/page.tsx требует `hasCapability("admin.full")` — хелпер
  прав не проверяет (он чистый расчёт), проверки остаются в страницах.

---

## Задача B. «Создать/Пересоздать документы» заполняет ФИО и должности за человека

### Какая кнопка (подтверждено)

Кнопка со скриншота — «Пересоздать документы» / «Создать все документы» из
`src/components/settings/onboarding-finish-cta.tsx:132-148` (финал быстрой
настройки, рендерится на `/settings/onboarding:201-205` и на advanced-странице).
Она зовёт `POST /api/settings/journal-responsibles/recreate-documents`
(`src/app/api/settings/journal-responsibles/recreate-documents/route.ts`).

### Как работает создание сейчас (цепочка)

```
recreate-documents/route.ts:91  prefillResponsiblesForNewDocument()
  └─ journal-responsibles-cascade.ts:362-393
       ├─ fetchOrgDataForDefaults()   (:22-54 — areas, equipment, users(id,name,role), products)
       ├─ getDefaultConfigForJournal(code, orgData)   (journal-default-configs.ts:252)
       │    └─ PROVIDERS[code](orgData)  — per-journal дефолтный config
       └─ patchDocumentConfig()  — раскладывает slot-ответственных по конфигу
route.ts:111  db.journalDocument.create({ config, responsibleUserId, verifierUserId })
route.ts:137  seedEntriesForDocument()  (journal-document-entries-seed.ts)
```

### Кто уже получает сотрудников, а кто нет (инвентаризация)

**Уже хорошо (не трогать):**
- `hygiene`, `health_check` — per-employee-per-day entries на весь активный ростер
  (`journal-document-entries-seed.ts:139-201`, с fallback'ом на весь ростер).
  Должность в гриде/PDF выводится `jobPosition.name → positionTitle → лейбл роли`
  (см. `document-pdf.ts:5947`).
- `med_books` — ростер строится на лету из активных users при рендере
  (`(dashboard)/journals/[code]/page.tsx:1589`, `emptyMedBookEntry`).
- `climate_control` (rooms из areas), `cold_equipment_control` (из equipment),
  `general_cleaning` (из areas), `glass_items_list`, `equipment_calibration`,
  `equipment_maintenance` — enriched из orgData (journal-default-configs.ts:88-219).
- `cleaning_ventilation_checklist` — уже получает users (:127-137).

**Дыра (провайдер игнорирует orgData, хотя builder «FromUsers» существует и уже
используется в ручном пути `POST /api/journal-documents` route.ts:480-610):**

| Код журнала | Сейчас (journal-default-configs.ts) | Должно стать |
|---|---|---|
| `finished_product` (:158) | `getDefaultFinishedProductDocumentConfig()` | `buildFinishedProductConfigFromUsers(orgData.users, orgData.products.map(p=>p.name))` (finished-product-document.ts:130) |
| `staff_training` (:226), `complaint_register` (:236), `pest_control` (:238), `traceability_test` (:248), `uv_lamp_runtime` (:138), `fryer_oil` (:113) | `getDefaultRegisterDocumentConfig()` | `buildRegisterDocumentConfigFromUsers(orgData.users)` (register-document.ts:146) — заполняет только `defaultResponsibleUserId`, rows остаются `[]` (event-based) |
| `ppe_issuance` (:228) | `getPpeIssuanceDefaultConfig([])` | `getPpeIssuanceDefaultConfig(orgData.users)` — default issuer = менеджер (ppe-issuance-document.ts:82) |
| `incoming_control`, `incoming_raw_materials_control` (:148-151) | `getAcceptanceDocumentDefaultConfig([])` | `getAcceptanceDocumentDefaultConfig(orgData.users)` (acceptance-document.ts:298 — default responsible) |
| `intensive_cooling` (:111) | `getDefaultIntensiveCoolingConfig([])` | `getDefaultIntensiveCoolingConfig(orgData.users)` (intensive-cooling-document.ts:185) |
| `cleaning` (:117) | `getDefaultCleaningDocumentConfig()` (= `defaultCleaningDocumentConfig()` без аргументов, cleaning-document.ts:2314) | `defaultCleaningDocumentConfig(orgData.users, orgData.areas)` (:1037) — комнаты из areas + дефолтные ответственные из users |
| `audit_plan` (:242) | `getAuditPlanDefaultConfig()` → колонки с заглушкой `ООО "Тест"` | `getAuditPlanDefaultConfig({ organizationName: orgData.organizationName, users: orgData.users })` (audit-plan-document.ts:276) |

**Изменения по шагам:**

**Шаг B1. `src/lib/journal-responsibles-cascade.ts:42-46`** — в select users добавить
`positionTitle: true, jobPosition: { select: { name: true } }`; в
`fetchOrgDataForDefaults` добавить чтение `organization.name` (одним запросом с
остальными) и вернуть его в orgData.

**Шаг B2. `src/lib/journal-default-configs.ts`** —
- расширить `DefaultConfigOrgData` (:71-82): `users` получает optional
  `positionTitle?: string | null; jobPositionName?: string | null`, плюс поле
  `organizationName?: string`. Все существующие вызовы остаются валидны (поля optional).
- переписать провайдеры из таблицы выше по шаблону
  `if (orgData?.users?.length) { …FromUsers(…) } return …Default…()` — ровно как уже
  сделано для `climate_control`/`cold_equipment_control`.

**Шаг B3. Должность, когда её нет.** Builders подписывают должность через
`getHygienePositionLabel(role)` (лейбл роли: «Повар», «Заведующая» и т.п.). Правильный
порядок — как в PDF (`document-pdf.ts:5947`): `jobPosition.name → positionTitle →
лейбл роли`. Где builder принимает title/должность (`cleaning-ventilation`,
`ppe_issuance.defaultIssuerTitle`, `finished_product` — там только имена) — передавать
это значение, добавив в builders optional-параметр ТОЛЬКО там, где они реально
печатают должность; не делать сквозной рефакторинг всех UserLike-типов ради этого
(karpathy: surgical change). Минимум: хелпер
`pickUserTitle(user)` внутри journal-default-configs.ts.

**Шаг B4. ЧЕГО НЕ ДЕЛАТЬ (проговорить в коде комментарием и в PR):**
- Никаких значений измерений. Температуры, отметки T/G/«/», коды С1/С2, подписи,
  даты осмотров — остаются пустыми. Автозаполненное измерение в journals ХАССП =
  подлог, это compliance-документы. Заполняем только: ФИО, должность,
  ответственных/проверяющих, списки строк (комнаты, оборудование, каталог продуктов).
- Не трогать маркер `_autoSeeded` (`journal-document-entries-seed.ts:124-133,188-193`):
  засеянные entry не должны считаться «заполненными».
- Не расширять `PER_DAY_JOURNALS`/`PER_EMPLOYEE_PER_DAY_JOURNALS` — event-based
  журналы (приёмка, ЧП, инструктажи) строк «на будущее» не получают, там строка =
  событие. `uv_lamp_runtime` сознательно не сидится (см. комментарий P8 :40-44) —
  оставить.

**Шаг B5. «Бумажные» журналы — честный ответ и что реально можно сделать.**

Бумажные журналы (`PAPER_JOURNALS` в `src/lib/sphere-journal-rules.ts:150+`,
`paperJournalsFor()` :463) — это НЕ JournalDocument. У них нет записей в БД вообще:
`/api/settings/journals/paper/[id]/pdf/route.ts:14-16` прямо говорит «Ничего не
сохраняем: эти журналы живут на бумаге, в БД им места нет». Кнопка «Пересоздать
документы» их физически не касается и не должна касаться (для `ot_intro`/`ot_workplace`
электронная форма запрещена законом — ТК РФ ст. 22.1 ч. 3).

Что МОЖНО и нужно сделать — предзаполнить печатную форму сотрудниками:
- `src/app/(dashboard)/settings/journals/paper/[id]/page.tsx` — добавить запрос
  активных users (`name`, `positionTitle`, `jobPosition.name`, опц. год рождения нет
  в модели — колонку «Год рождения» оставить пустой) и передать в редактор проп
  `initialRows: string[][]`.
- Маппинг колонок по названию (колонки — строки в `PaperJournal.columns`):
  `col.includes("ФИО инструктируемого") → user.name`;
  `col.includes("должность") → jobPosition.name ?? positionTitle ?? ""`;
  всё остальное (даты, вид инструктажа, подписи) — `""`. Подписи ОБЯЗАТЕЛЬНО пустые —
  они живые, в этом весь смысл бумажного журнала.
- `paper-journal-editor.tsx:24-26` — `useState(() => initialRows?.length ? initialRows :
  <пустые START_ROWS>)`; добавить тихую пилюлю-подсказку «Сотрудники подставлены
  автоматически — допишите даты и соберите подписи» (recipe Tag/pill из
  design-system) и кнопку «Очистить строки» (не деструктивная, без модалки).
- PDF-путь менять не надо: `renderPaperJournalPdf` уже принимает `rows`
  (`paper-journal-pdf.ts:50-53`), POST-роут уже их прокидывает (:55-67).

Итог по «бумажным»: «заполнить их по кнопке создания журналов» невозможно и не нужно
(нет сущности в БД); «сократить письменный ввод» — возможно и делается предзаполнением
строк редактора бланка. Это и есть выполнение просьбы владельца в рамках закона.

**Шаг B6. UX-долг той же кнопки (обязателен по CLAUDE.md, принцип 6).**
`onboarding-finish-cta.tsx:33-41` использует `window.confirm` — запрещено. Заменить на
`<ConfirmDialog>` из `src/components/ui/confirm-dialog.tsx`, вариант `warn`,
bullet-список последствий: «Старые активные документы закроются (записи сохранятся)»,
«Заведутся свежие — строки с сотрудниками и должностями уже вписаны», «Показатели,
подписи и отметки останутся пустыми — их заполняют люди». Текст третьего пункта —
осознанно: он проговаривает пользователю границу автозаполнения.

**Шаг B7 (низкий приоритет, отдельный коммит, можно отложить).** Ручной путь
`POST /api/journal-documents` (route.ts:480-660) и PROVIDERS теперь дублируют
знание «какой билдер для какого журнала». Полная конвергенция — большой рефакторинг;
в этом батче НЕ делать, оставить TODO-комментарий с перекрёстной ссылкой.

**Шаг B8. WhatsNew** — пункт «Кнопка "Создать документы" теперь сама вписывает
сотрудников и должности во все журналы; бланки бумажных журналов печатаются с уже
заполненным списком сотрудников».

### Критерии приёмки B

- AC-B1: `npx tsc --noEmit --skipLibCheck`, `npm run lint` — чисто.
- AC-B2: на seed-организации нажать «Пересоздать документы» → открыть
  `finished_product`: в строке-заготовке стоят ФИО ответственного и проверяющего;
  `cleaning`: комнаты из areas + ответственные заполнены; `ppe_issuance`:
  «Кто выдал» предзаполнен; `staff_training`/`pest_control`/`complaint_register`:
  defaultResponsibleUserId задан (виден как дефолт в форме добавления строки);
  `audit_plan`: в шапке имя организации, не `ООО "Тест"`.
- AC-B3: во всех пересозданных документах НЕТ ни одного заполненного показателя:
  температуры/отметки/подписи пусты; grep по diff'у не добавляет значений в
  `data` кроме `_autoSeeded`.
- AC-B4: `/settings/journals/paper/ot_intro` открывается со строками по числу
  активных сотрудников: ФИО и должность заполнены, остальные колонки пустые; скачанный
  PDF содержит эти строки; кнопка «Очистить строки» возвращает пустой бланк.
- AC-B5: recreate-documents по-прежнему идемпотентен по rate-limit (2/час) и
  не трогает выключенные журналы (`disabledJournalCodes`).
- AC-B6: в `onboarding-finish-cta.tsx` нет `window.confirm` (grep), диалог —
  ConfirmDialog с тремя bullet'ами.

### Риски B

- `buildRegisterDocumentConfigFromUsers` берёт `users[0]` слепо
  (register-document.ts:146-155) — при сортировке по имени это может быть не менеджер.
  Допустимо улучшить выбором через существующий `pickPrimaryManager`-паттерн
  (есть в ppe/intensive-cooling), но НЕ менять сигнатуру.
- `prefillResponsiblesForNewDocument` пропускает дефолты, если caller передал
  непустой `baseConfig` (cascade.ts:386-393) — recreate передаёт `{}`, значит путь
  активен; но `ensureActiveDocument` (journal-auto-create.ts) для некоторых журналов
  переиспользует config предыдущего документа — это правильно (наследование), не
  ломать.
- Изменение default-конфигов влияет и на ночной cron автосоздания
  (`/api/cron/auto-create-journals` → те же PROVIDERS) — это желаемый эффект, но
  проверить, что cron не падает на организациях без users (все builders обязаны
  переживать пустой массив — они это уже умеют, ветка `if (orgData?.users?.length)`).
- Большие организации: `initialRows` бумажного бланка на 200 сотрудников — PDF станет
  многостраничным; jspdf-autotable это умеет, но проверить на 50+ строках.

---

## Задача C. PrintAgent — референс Magday найден

> Обновлено после того, как исходники Magday нашлись на диске. Прошлая
> версия этого раздела строилась на догадках («нужен WebSocket», «Magday
> в репозитории не упоминается») — они оказались неверны, и раздел
> переписан по фактическому коду.

### Где лежит рабочий референс

На `C:\www` два готовых агента печати, оба боевые:

| Путь | Что это |
|---|---|
| `C:\www\YandexEdaPrintAgent` | C# .NET Framework 4.8, WinForms. Печатает через **SumatraPDF**, опрос раз в 5 сек. 2075 строк, вся логика в `Program.cs`. Есть `README.md` и `docs/log-format.md`. |
| `C:\www\managermagday\print-agent` | **Node.js** + `puppeteer-core`. Ближе нам: наш стек, Electron-трей (`tray-app/`), установка службой через `install-service.bat` (NSSM), автозапуск. |
| `C:\www\magday-backend\api\manager\print.php` | Серверная часть, 548 строк. Очередь `print_jobs` в SQLite. |
| `C:\www\printAgent` | Собранный бинарник на кассе (exe + SumatraPDF + config). |

Брать за основу надо **Node-агента из `managermagday`**: он на нашем языке,
у него уже есть трей, служба и автозапуск — ровно то, что просит владелец.

### Протокол (снят с кода, а не придуман)

Никакого WebSocket — обычный HTTP-поллинг с токеном в query. Это и
правильно: агент стоит за NAT в кафе, входящих соединений к нему нет.

```
GET  ?action=poll&token=<agentToken>[&source=<channel>]
     → отдаёт самое старое pending-задание и помечает его printing
POST {action:"complete", token, id}        → done + printed_at
POST {action:"fail", token, id, error}     → error + error_msg (255 симв.)
GET  ?action=view&token=<agentToken>       → страница истории печати
GET  ?action=cleanup&force=1&token=...     → отменить всё pending/printing
```

Ключевые решения референса, которые стоит повторить:

- **Самолечение зависших заданий**: `UPDATE print_jobs SET status='pending'
  WHERE status='printing' AND created_at < :cutoff`. Агент мог умереть
  посреди печати — без этого задание висит вечно.
- **Статусы**: `pending → printing → done | error | cancelled`.
- **Каналы (`source`)**: один агент слушает свой набор источников. У
  Magday так разведены чеки Я.Еды, киоск и этикетки; у нас это будут
  журналы против отчётов.
- **Разные принтеры под разные задания** (`labelPrinterName` для этикеток).
  Нам нужно позже, но заложить `source` в модель стоит сразу.
- Агент **ничего не масштабирует**: PDF приходит готовым, он печатает
  «как есть». Вся вёрстка остаётся на сервере — у нас она уже есть.

### Чего повторять НЕ надо

Magday кладёт сам файл в очередь: `file_content` — base64 прямо в строке
таблицы. Для чека это нормально, для журнала на месяц — нет: PDF бланка
весит сотни килобайт, и очередь распухнет.

У нас PDF уже собирается на лету (`/api/journal-documents/[id]/pdf`,
`document-pdf.ts`). Поэтому в `PrintJob` храним **ссылку на документ**, а
не байты, и агент забирает файл отдельным запросом со своим токеном:

```
GET /api/print/agent/jobs/<jobId>/file   (Bearer <agentToken>)
```

Это и очередь держит лёгкой, и убирает дубль «PDF в базе против PDF на лету».

### Разрез по системам

**Живёт в Wesetup (этот репозиторий):**

1. Модели `PrintAgent` (организация, имя точки, хеш токена, `printerName`,
   `lastSeenAt`) и `PrintJob` (организация, агент, `documentId`, `source`,
   статус, `error`, `printedAt`). Хеш токена — как у `InspectorToken`,
   плейнтекст не храним.
2. `/api/print/agent` — poll/complete/fail по протоколу выше.
3. `/api/print/agent/jobs/<id>/file` — отдаёт готовый PDF.
4. `POST /api/print/jobs` — постановка в очередь из интерфейса.
5. Кнопка «На принтер» рядом с «Скачать PDF» в панели документа
   (`document-actions-bar.tsx`) — то самое «с телефона жмякнул и готово».
6. Страница `/settings/print-agent`: выпуск токена, имя точки, статус
   соединения (`lastSeenAt` свежее двух минут), история печати.
7. Блок «Онлайн принтер» на дашборде — статус и ссылка на скачивание.

**Живёт отдельной программой:** Node-агент по образцу `managermagday/print-agent`
(поллинг, печать, трей, служба, автозапуск). В репозиторий Wesetup не кладём.

### Первый шаг, который даёт пользу без десктопа

Пункты 1–4 и 6 сами по себе бесполезны, пока некому печатать. Поэтому
начинать надо с пары «очередь + агент», а не с одной очереди. Но объём
первого шага можно резко сократить: взять `print-agent.js` Magday,
выкинуть из него puppeteer (нам HTML→PDF не нужен, у нас уже PDF) и
поменять адреса эндпоинтов. Останется ~150 строк вместо 350.

### Что нужно от владельца

- Где живёт репозиторий агента: в ProjectsFlow уже заведён проект
  `PrintAgent` — вести там?
- Название и иконка для трея, и под каким именем ставить службу.
- Нужны ли сразу несколько принтеров на точку (этикетки против бланков)
  или на старте хватит одного.

### Риски C

- **Базовая аутентификация агента**: токен уходит в query-строке (так у
  Magday). У нас лучше сразу Bearer-заголовком — query-строки попадают в
  логи nginx целиком.
- **Разрастание очереди**: нужен cron-cleanup, как у TasksFlow-outbox, и
  тот же самолечащий сброс зависших `printing`.
- **Печать чужого документа**: `PrintJob` обязан проверяться по
  `organizationId` агента, иначе токен одной точки распечатает журнал
  другой организации.

## Общее

- Коммиты на русском, после каждого — `git push origin master` (CLAUDE.md Git Workflow).
- A и B — один WhatsNew-апдейт на двоих (шаги A5/B8), SHA — финального коммита батча.
- Проверки: `npx tsc --noEmit --skipLibCheck`, `npm run lint`; ручная проверка по
  AC-спискам на dev (`npm run dev`, PGlite).
