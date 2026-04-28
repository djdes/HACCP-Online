# Паттерны заполнения журналов ХАССП

> Дизайн-документ. Описывает для **каждого** из 35 журналов: кто
> заполняет, как раздаются задачи в TasksFlow, что из стандартов
> неоднозначно и как настраивается per-org. После утверждения
> пользователем — реализуется постепенно по списку.
>
> **Эталон** — то что мы уже сделали для `cleaning` (rooms-mode):
>   1. Subjects (rooms / equipment / employees / events) — настраиваются
>      в /settings/buildings или /settings/equipment или per-journal.
>   2. Race-задачи (одна задача на subject × актёр) — кто первый закрыл,
>      тот и закрепил.
>   3. JournalDocumentEntry с data.kind = "{journal_code}_..." пишется
>      по webhook'у при close.
>   4. Single agg-задача контролёру в конце дня (control-digest cron)
>      → controllerUserId + controllerCompletedAt в entries.
>   5. PDF/UI grid — точь-в-точь как в стандарте.
>   6. Per-org настройка для неоднозначных моментов (в /settings).

---

## Группа A. Daily-temperature & hygiene (полумесячные на haccp-online.ru)

### A1. `hygiene` — Гигиенический журнал
- **Стандарт:** СанПиН 2.3/2.4.3590-20, личная гигиена сотрудников.
- **Subjects:** список **сотрудников кухни/зала** (фильтр по
  `JobPosition`).
- **Period:** полумесячный по умолчанию.
- **Заполнение:** ежедневно за смену сотрудник проставляет «здоров /
  выходной / болен / отпуск». Сейчас — ручная грид-таблица в Mini App.
- **TasksFlow pattern:** одна **personal recurring task** на каждого
  сотрудника каждый день — он тапает «принят на смену» (фото = mark).
- **Контроль:** **руководитель смены** утром или вечером проходит и
  ставит подпись в строке «Контролёр».
- **Неоднозначно:** проверять ли температуру (37° toggle) обязательно?
  → setting `requireTemperatureCheck: bool`.
- **Status в нашем коде:** есть `health_check` template + UI grid.

### A2. `health_check` — Журнал здоровья
- Объединён с `hygiene` де-факто (same employees). На haccp-online.ru
  — отдельный журнал. У нас тоже два template'а.
- **Можем merge** в одном UI?  → setting `mergeWithHygiene: bool`.

### A3. `climate_control` — Контроль t°/влажности (производственные
помещения)
- **Subjects:** **зоны** (Areas) с указанным min/max t° и влажности.
- **Period:** полумесячный.
- **Pattern:** при каждом замере — race-задача (оператору цеха).
  3 раза в день (утро, день, вечер — `times[]` в config).
- **Контроль:** technologist подписывает раз в день / раз в неделю —
  setting.
- **Неоднозначно:** сколько раз в день? → `measurementsPerDay: 1..6`.

### A4. `cold_equipment_control` — Контроль t° холодильников
- **Subjects:** список **Equipment** (холодильники + морозильники).
- **Period:** полумесячный.
- **Pattern:** 2 раза в день (утро/вечер) на каждое оборудование.
  Race-задача между всеми поварами/сменщиками; первый замерил —
  закрепил.
- **Tuya integration**: если есть IoT датчик, авто-fill через cron.
- **Контроль:** старший повар утром.
- **Неоднозначно:** требовать ли подпись повара или просто галочку
  → `requireSignerName: bool`.

---

## Группа B. Cleaning (3 журнала)

### B1. `cleaning` — Журнал уборки ✅ **сделано**
- Текущая, race-mode + control-digest. Эталон.

### B2. `general_cleaning` — Генеральная уборка
- **Period:** годовой (есть в YEARLY_JOURNAL_CODES).
- **Subjects:** те же `rooms` что и `cleaning`.
- **Pattern:** раз в неделю / раз в месяц per-room — race-задача
  «генералка X помещения». Один cleaner закрывает.
- **Контроль:** инженер-технолог раз в месяц.
- **Неоднозначно:** периодичность — `weekly | biweekly | monthly`
  per-room → setting в room.

### B3. `cleaning_ventilation_checklist` — Чек-лист очистки вентиляции
- **Subjects:** воздухопроводы / вытяжки / фильтры (можно свести в
  Equipment с типом `ventilation`).
- **Period:** месячный или квартальный.
- **Pattern:** одна задача на все воздуховоды — большой чек-лист
  пунктов; кто-то один закрывает.
- **Контроль:** инженер.

---

## Группа C. Производственные температуры (4 журнала)

### C1. `intensive_cooling` — Интенсивное охлаждение
- **Subjects:** **батчи блюд** (event-driven, не повторяется).
- **Pattern:** **single-day events** — каждый раз когда повар готовит
  блюдо требующее охлаждения, создаёт запись.
- **TasksFlow:** не фан-аутится массово — кнопка «начать охлаждение»
  в Mini App создаёт задачу.
- **Контроль:** не требуется, если все параметры в норме (auto-CAPA
  если t° не упала за 2 часа).

### C2. `fryer_oil` — Учёт фритюрных жиров
- **Subjects:** **фритюрницы** (Equipment).
- **Period:** месячный.
- **Pattern:** ежедневно повар замеряет полярность масла — race на
  фритюрницу.
- **Неоднозначно:** **сколько TPM (Total Polar Material)** разрешено?
  → setting `maxTPM: number` (обычно 24%).

### C3. `finished_product` — Бракераж готовой продукции (Прилож. 4)
- **Subjects:** **блюда** (per-cook session).
- **Period:** месячный.
- **Pattern:** при каждом готовом блюде шеф-повар + бракеражная
  комиссия (3 человека). Race на 3 подписей.
- **Неоднозначно:** **состав комиссии** (1 / 2 / 3 человека) →
  setting `brakeragCommissionSize: 1..3`.

### C4. `perishable_rejection` — Отбраковка скоропортящейся (Прилож. 5)
- **Subjects:** **продукты при приёмке**.
- **Pattern:** event-driven — приёмщик пишет каждую партию.

---

## Группа D. Приёмка / списание (5 журналов)

### D1. `incoming_control` — Контроль входящего сырья
- **Subjects:** **поставки**.
- **Pattern:** event-driven — приёмщик при каждой поставке. **Photo
  required** (фото накладной).
- **Контроль:** technologist раз в неделю просматривает.

### D2. `incoming_raw_materials_control` — Контроль вход. сырья (детально)
- Дублирует D1 на проде; объединить или оставить — пользователь решает.

### D3. `product_writeoff` — Акт забраковки
- **Pattern:** event-driven при списании. Auto-classify L9 уже есть.

### D4. `metal_impurity` — Учёт металлопримесей
- **Subjects:** **металлодетекторы** (Equipment).
- **Pattern:** ежедневная проверка работоспособности — race на
  metaldetector.

### D5. `traceability_test` — Прослеживаемость продукции
- **Pattern:** годовой test 1-2 раза в год event-driven — manager
  выбирает партию и прослеживает её путь от поставщика до клиента.

---

## Группа E. Кадры (5 журналов, годовые)

### E1. `med_books` — Медицинские книжки
- **Subjects:** **сотрудники**.
- **Pattern:** годовой документ, owner ведёт. Auto-block уже есть.

### E2. `training_plan` — План обучения
- **Pattern:** годовой, owner / technologist.

### E3. `staff_training` — Журнал обучения
- **Pattern:** event-driven при каждом обучении.

### E4. `ppe_issuance` — Учёт СИЗ
- **Subjects:** сотрудники × тип СИЗ.
- **Pattern:** event-driven при выдаче.
- **Неоднозначно:** **категории СИЗ** (фартук, перчатки, маска…) →
  setting `ppeCategories: string[]`.

### E5. `accident_journal` — Аварии
- Event-driven, годовой.

### E6. `complaint_register` — Жалобы
- Event-driven, годовой.

---

## Группа F. Оборудование (5 журналов)

### F1. `equipment_maintenance` — ТО оборудования
- **Subjects:** **Equipment**.
- **Pattern:** годовой; **планируется** руководителем — race не нужна,
  это план.

### F2. `breakdown_history` — Карточка поломок
- Event-driven; история.

### F3. `equipment_calibration` — Калибровка
- **Subjects:** Equipment с `requiresCalibration: true`.
- **Pattern:** годовой; событие = калибровка раз в N мес/лет.
- **Неоднозначно:** **периодичность калибровки** per-equipment →
  setting `calibrationIntervalMonths: 6 | 12 | 24`.

### F4. `equipment_cleaning` — Очистка оборудования
- **Subjects:** Equipment.
- **Pattern:** ежедневная или еженедельная race-задача.
- **Аналогично cleaning rooms-mode** — кандидат на тот же rewrite.

### F5. `glass_items_list` — Список стеклянных изделий
- **Subjects:** **глассварь** (новая модель `GlassItem` или просто
  config-array).
- **Pattern:** годовой list, обновляется вручную.

---

## Группа G. Стекло / Сан-день (3 журнала)

### G1. `glass_control` — Контроль стекла
- **Subjects:** glassItems из G5.
- **Pattern:** ежедневная race на каждый предмет — кто проверил
  целостность.

### G2. `sanitary_day_control` — Сан-день контроль
- **Pattern:** event-driven, perpetual. Каждый сан-день =
  отдельное мероприятие.

### G3. `sanitary_day_checklist` — Чек-лист сан-дня
- **Pattern:** при каждом сан-дне — большой чек-лист пунктов
  (десятки helping points).
- **Неоднозначно:** **набор пунктов** — по умолчанию из стандарта,
  но кафе может добавить свои → setting `customChecklistItems[]`.

---

## Группа H. Служебные (3 журнала)

### H1. `disinfectant_usage` — Учёт дезсредств
- **Subjects:** **дезсредства** (новая модель `Disinfectant` или
  config-array per-org).
- **Pattern:** event-driven при каждом использовании — кто, какой
  раствор, сколько, где.
- **Perpetual** документ.

### H2. `pest_control` — Дератизация
- **Pattern:** годовой, event-driven при каждой обработке (обычно
  сторонний подрядчик).

### H3. `uv_lamp_runtime` — Учёт работы UV-ламп
- **Subjects:** UV-лампы (Equipment с `kind: "uv_lamp"`).
- **Pattern:** ежедневный учёт часов работы. Race на каждую лампу.
- **Неоднозначно:** **ресурс лампы** (часов до замены) → setting
  `uvLampMaxHours: 8000` (обычно).

---

## Группа I. Аудиты (3 журнала)

### I1. `audit_plan` — План аудитов (годовой)
### I2. `audit_protocol` — Протокол аудита (event-driven)
### I3. `audit_report` — Отчёт аудита (event-driven)
- **Pattern:** event-driven; редко (раз в год / по требованию).
  TasksFlow задачи не нужны — это работа manager-а.

---

## Универсальные принципы

### Configurable settings (per-org per-journal)

Расширить `Organization.journalSettings` (новое поле):
```json
{
  "hygiene": { "requireTemperatureCheck": true, "actorRole": "cook" },
  "cleaning": { "controlIntervalDays": 1 },
  "fryer_oil": { "maxTPM": 24 },
  "ppe_issuance": { "categories": ["перчатки","маска","фартук"] },
  "uv_lamp_runtime": { "maxHours": 8000 },
  ...
}
```

Доступ: `/settings/journal-rules` (новая страница, с табами по
группам A-I).

### Race vs personal задачи

| Pattern | Когда |
|---|---|
| **Race на subject** (room/equipment/glass-item) | A3, A4, B1, B2, C2, D4, F4, G1, H3 |
| **Personal recurring** (на сотрудника) | A1, A2 |
| **Event-driven** (создаётся вручную) | C1, C3, C4, D1-D3, D5, E3-E6, F2, G2, G3, H1, H2, I2, I3 |
| **Manager-only план** | E2, F1, F3, F5, I1 |

### Контрольная подпись

Для всех журналов нужна **строка контроля** в PDF и UI. Универсальный
mechanism (как у cleaning):
- В config: `controlUserId: string | null`, `controlIntervalDays: 1|7|30`
- В webhook complete агрегируется одна задача контролёру
- В entries записывается `controllerUserId + controllerCompletedAt`

---

## Реализация — порядок

1. **Универсальный helper** `lib/journal-fill-mode.ts` с pattern-ами
   и настройками. Сейчас разбросано по адаптерам.
2. **Новая страница `/settings/journal-rules`** — таблица всех 35
   журналов × per-journal-settings (configurable fields).
3. **Group по 3-5 журналов** в каждом коммите → постепенный rollout
   адаптеров и UI.
4. **PDF render** для всех новых журналов (по образцу cleaning).
5. **Cron `journal-control-digest`** универсальный — собирает все
   journals с `controlUserId` и шлёт сводки контролёрам.

Реалистично — **3-5 коммитов на группу**, всего ~25-30 коммитов.
Каждый изолированно безопасен (feature flag `journalSettings.{code}`),
старая логика остаётся для незаконфигурированных journals.

---

## Решения которые жду от тебя

1. **Объединить ли** `hygiene` + `health_check` в один UI? (рекомендую да, опц через setting)
2. **Объединить ли** `incoming_control` + `incoming_raw_materials_control`? (рекомендую да)
3. **Группа реализации сначала?** Я бы взял Группу A (4 журнала + cold_equipment у нас уже почти готов через Tuya) — это **главные ежедневные** журналы. Потом B (уже сделан cleaning), потом F (оборудование).
4. **Где placeholder'ы для настройки** — `/settings/journal-rules` (одна большая страница) или per-journal в его UI? (я бы делал per-journal на странице каждого типа документа.)

После твоих ответов начну с **A1 hygiene** (rewrite по эталону cleaning).
