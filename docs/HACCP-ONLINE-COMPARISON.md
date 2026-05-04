# Comparison: haccp-online.ru ↔ wesetup.ru

Audit: 2026-05-04, тестовый аккаунт `test4`/`test8` на https://lk.haccp-online.ru/.

## Список журналов у haccp-online (URL slug → название)

### Тариф «Базовый»
- `healthjournal` — Гигиенический журнал
- `health1journal` — Журнал здоровья
- `storageconditionjournal` — Бланк контроля температуры и влажности
- `temprefrigerationjournal` — Журнал контроля температурного режима холодильного и морозильного оборудования
- `sanitation1journal` — Чек-лист уборки и проветривания помещений
- `cleaning1journal` — Журнал уборки
- `sanitationdayjournal` — График и учет генеральных уборок
- `bactericiplantjournal` — Журнал учета работы УФ бактерицидной установки
- `brakeryjournal` — Журнал бракеража готовой пищевой продукции
- `brakery1journal` — Журнал бракеража скоропортящейся пищевой продукции
- `acceptance1journal` — Журнал приемки и входного контроля продукции
- `deepfatjournal` — Журнал учета использования фритюрных жиров
- `medbook` — Медицинские книжки

### Тариф «Расширенный»
- `eduplan` — План обучения персонала
- `edujournal` — Журнал регистрации инструктажей (обучения) сотрудников
- `disinfectjournal` — Журнал учета дезинфицирующих средств
- `sanitationdaycheklist` — Чек-лист (памятка) проведения санитарного дня
- `preventiveequipment` — График профилактического обслуживания оборудования
- `breakdownhistoryjournal` — Карточка истории поломок
- `instrumentcalibration` — График поверки средств измерений
- `acceptance2journal` — Журнал входного контроля сырья, ингредиентов, упаковочных материалов
- `issuancesizjournal` — Журнал учета выдачи СИЗ
- `accidentjournal` — Журнал учета аварий
- `complaintjournal` — Журнал регистрации жалоб
- `defectjournal` — Акт забраковки
- `auditplan` — План-программа внутренних аудитов
- `auditprotocol` — Протокол внутреннего аудита
- `auditreport` — Отчет о внутреннем аудите
- `traceabilityjournal` — Журнал прослеживаемости продукции *(не дошёл до URL'а — но есть в списке)*
- `metalimpurityjournal` — Журнал учета металлопримесей в сырье
- `equipmentcleaningjournal` — Журнал мойки и дезинфекции оборудования
- `intensivecoolingjournal` — Журнал контроля интенсивного охлаждения горячих блюд
- `glasslistjournal` — Перечень изделий из стекла и хрупкого пластика
- `glasscontroljournal` — Журнал контроля изделий из стекла и хрупкого пластика
- `pestcontroljournal` — Журнал учета дезинфекции, дезинсекции и дератизации

**Покрытие:** все 30+ haccp-online журналов имеют у нас аналог.

## Ключевые UI-паттерны и фичи haccp-online

### Стандартный header страницы списка документов
- Crumbs «ООО {имя}» > «{журнал}»
- H1 заголовок
- Tab-bar «Активные» / «Закрытые»
- Кнопка «Инструкция» (открывает PDF/модалку с гайдом)
- Кнопка «+ Создать документ» (primary indigo)
- Каждый документ — карточка «Период {Май с 1 по 15} | {Title} | {Должность ответственного}» + 3-точки menu

### Внутри документа (общие элементы)
- Crumbs «ООО {имя}» > «{журнал}» > «{doc-title}»
- H1 + кнопка «Настройки журнала» (модалка с title/role/periodicity)
- **Auto-fill toggle** «Автоматически заполнять журнал» (banner с gradient + chevron-toggle):
  - При раскрытии — config: ответственные, дополнительные опции (например, «Не заполнять в выходные»)
- **Document header table**:
  - Колонка: «ООО {имя}»
  - Средняя: «СИСТЕМА ХАССП» (top) + «{Полное название журнала}» (italic, bottom)
  - Правая: «СТР 1 ИЗ 1» (или «Начат: 01-05-2026 | Окончен: —»)
- Под header'ом — H2 «{ЗАГОЛОВОК ЖУРНАЛА}» большим caps
- **Кнопки данных**:
  - «+ Добавить» (с dropdown-стрелкой — выбор того что добавить: запись/строку/помещение/сотрудника)
  - Для journals со словарями: «+ Добавить изделие» / «Редактировать список изделий»
- **Основная таблица** — стилизована под бумажный журнал: чёрные тонкие границы, моноширинный текст в ячейках, заголовки колонок с переносом
- **Условные обозначения** (legend) — italic underlined header + список сокращений
- **Reference/method table** под основной (для cleaning — «Что моется в каждом помещении»)
- **Print icon** в верхней панели (печать всего журнала)
- **Колокольчик-уведомления** с red badge

### Конкретные находки по журналам

#### Гигиенический журнал (`healthjournal`)
- Auto-fill toggle on/off
- Период «Май с 1 по 15» (полумесяц = 1-15 / 16-31)
- Matrix: ФИО × День (1-15), 2 sub-row на сотрудника:
  - status (Зд/В/Б/л/ОТ/Отп)
  - «Температура сотрудника более 37°C? нет/да»
- Ссылка-text «Должность ответственного за контроль» в нижней строке таблицы
- Условные обозначения внизу
- Большой описательный блок «В журнал регистрируются результаты:» — текст про что регистрируется

#### Журнал уборки (`cleaning1journal`)
- Auto-fill toggle с config-секцией внутри:
  - Ответственный за уборку (dropdown сотрудник + автозаполнение должности)
  - Ответственный за контроль (dropdown)
  - **Чекбокс «Не заполнять в выходные дни»**
- Header table + matrix Помещение × День
- Cells: T (текущая) / Г (генеральная) / C1 (подпись)
- Helper rows внизу таблицы: «Ответственный за уборку: C1 — Борисов Б.Б., C2 — Иванов И.И.», «Ответственный за контроль: C1 — Иванов И.И.»
- **Reference table** «Что моется в каждом помещении» — Помещение × Текущая уборка × Генеральная уборка (с конкретным списком поверхностей)
- **«+ Добавить» dropdown**: видимо позволяет добавить помещение, ответственного

#### Бракераж готовой продукции (`brakeryjournal`)
- Header table с **«Начат: дата» + «Окончен: —»** (живые даты, не period)
- 3 кнопки: «+ Добавить» (запись), «+ Добавить изделие» (в словарь), «Редактировать список изделий»
- Table per-record: Дата+время изготовления | Время снятия бракеража | Наименование блюд | Органолептика+степень готовности | T внутри продукта | Корректирующие действия | Время передачи курьеру | Ответственный исполнитель | ФИО проводящего бракераж
- Под таблицей раскрывающийся блок «Рекомендации по организации контроля за доброкачественностью готовой пищи»

### Дизайн-токены haccp-online
- Primary: `#5670f0` (indigo)
- Header bar: light tint `#f8f9ff`
- Pills/buttons: rounded-full, white bg with light-indigo border
- Document table: чёрные 1px borders, белый фон, текст 11-12px
- Heavy-formatted PDF-ready ("СТР 1 ИЗ 1" official formatting)

## Сравнение с wesetup.ru — что есть, чего нет

### ✅ Что у нас уже работает не хуже / лучше

| Feature | haccp-online | wesetup |
|---|---|---|
| Тёплый дизайн | строгий бумажный | indigo gradient + soft cards (приятнее) |
| Журналы | 30 | 35 |
| Гайды/инструкции | PDF-ссылка | inline FillingGuide modal с шагами/материалами/частыми ошибками |
| Auto-fill | toggle на каждом доке | toggle есть в нашем cleaning UI («автоматически заполнять») |
| TasksFlow интеграция | нет | есть, с per-room задачами |
| Audit-log | не видно | full audit + ROOT-страница |
| Per-room checklists | нет | есть (Stage 2) |
| Frequency (daily/weekly/monthly) | нет | есть |
| Per-room verifier | нет | есть (Stage 4) |

### ⚠️ Где у нас слабее (gaps для исправления)

#### G1. **Document title block (СИСТЕМА ХАССП × Журнал × СТР 1 ИЗ 1)**
**Где:** На КАЖДОМ нашем документе журнала (cleaning, hygiene, brakery, и т.д.).
**Что у haccp-online:** Большая 3-колонка с official-style оформлением: ООО {имя} | СИСТЕМА ХАССП + {Название} | СТР 1 ИЗ 1.
**Что у нас:** Скромный заголовок без официального ХАССП-блока.
**Эффект:** При печати/проверке РПН наши журналы выглядят менее «официально», что вредит ощущению полноты.
**Фикс:** Создать переиспользуемый компонент `<JournalDocumentHeader org={org} title={...} subTitle="СИСТЕМА ХАССП" pageInfo="СТР 1 ИЗ 1" />`. Применить ко всем journal-document-client'ам.

#### G2. **Print-icon в шапке документа**
**Где:** В каждом нашем journal-document-client.
**Что у haccp-online:** Иконка принтера справа в header — клик → печать всего документа в PDF-friendly формате.
**Что у нас:** Есть отдельная страница print, но иконку в шапке journal-document не видно везде.
**Фикс:** Добавить `<PrintButton onClick={() => window.print()} />` в шапку каждого journal-document-client. И настроить `@media print` стили чтобы скрыть hero/sidebar.

#### G3. **«Условные обозначения» legend под таблицей**
**Где:** В hygiene + cleaning matrix journals.
**Что у haccp-online:** Italic underlined header «Условные обозначения» + список сокращений (Зд = здоров, В = выходной, и т.д.) — для печати и понимания.
**Что у нас:** Нет.
**Фикс:** Добавить в hygiene journal-document footer block с легендой. То же — в cleaning (T/Г/C1).

#### G4. **«Не заполнять в выходные дни» checkbox для auto-fill**
**Где:** В cleaning auto-fill config.
**Что у haccp-online:** Чекбокс что суббота-воскресенье оставлять пустыми.
**Что у нас:** Есть config.skipWeekends в cleaning, но не везде в UI exposed.
**Фикс:** Проверить что toggle есть в нашем cleaning-document-client UI и работает.

#### G5. **Reference/method table «Что моется в каждом помещении»**
**Где:** В cleaning документе.
**Что у haccp-online:** Таблица под основным гридом: Помещение × Текущая уборка × Генеральная уборка (с конкретным списком поверхностей: «Пол, Стеллажи, полки, Двери», «Производственные столы, Пол, Моечные ванны, Стеллажи, Производственный инвентарь»).
**Что у нас:** Эта инфа лежит в `JournalChecklistItem` (per-room с label типа «Помыть пол»), но НЕ рендерится в самом journal-document как справочник.
**Фикс:** В нашем cleaning-document-client добавить секцию под matrix'ом: «Что моется в каждом помещении» — генерируется из `JournalChecklistItem` сгруппированных по `roomId`. Текущая = `frequency === 'daily'`, Генеральная = `frequency === 'weekly'/'monthly'`.

#### G6. **«+ Добавить изделие» / «Редактировать список изделий» (embedded dictionary)**
**Где:** В brakery, deepfat, intensiveCooling и т.п. — где есть dictionary продуктов/изделий.
**Что у haccp-online:** Прямо в шапке документа — кнопка добавить новое изделие в словарь + редактировать существующий список (модалка с CRUD).
**Что у нас:** Словари (`JournalReference`?) могут быть, но управляются отдельно.
**Фикс:** Проверить наличие dictionary management UI в нашем brakery; если нет — добавить.

#### G7. **«Окончен» date в header (для brakery)**
**Где:** Бракеражные журналы.
**Что у haccp-online:** В header table есть «Начат: 01-05-2026», «Окончен: —» (пока документ открыт; при закрытии заполняется).
**Что у нас:** Не явно.
**Фикс:** Добавить в JournalDocumentHeader для brakery type — «Начат / Окончен» вместо «СТР 1 ИЗ 1».

#### G8. **Раскрывающийся блок «Рекомендации по контролю» (footnote/hint)**
**Где:** Под brakery таблицей.
**Что у haccp-online:** Линк-кнопка «Рекомендации по организации контроля за доброкачественностью готовой пищи» — раскрывается длинный текст с СанПиН-выдержкой.
**Что у нас:** Это покрыто FillingGuide modal'ом, но не рядом с таблицей. Можно дополнить footer-блоком.

#### G9. **Нумерация СТР 1 ИЗ N (multi-page)**
**Где:** Все журналы.
**Что у haccp-online:** «СТР 1 ИЗ 1» (если 1 страница) — официальный ХАССП-формат для журналов.
**Что у нас:** Нет.
**Фикс:** Добавить в JournalDocumentHeader. Для multi-page журналов считать через 5-7 строк per-page.

#### G10. **Иконка-print в шапке дашборда**
**Где:** wesetup.ru/dashboard.
**Что у haccp-online:** Внутри журнала.
**У нас:** В журналах нужно добавить.

### 🟢 Что у нас лучше haccp-online (не трогаем)

| Feature | wesetup advantage |
|---|---|
| **TasksFlow интеграция** | у haccp-online её просто нет |
| **Per-room checklists с frequency** | у них только static «Что моется» reference, без проверки на сегодня |
| **Per-room verifier (разные контролёры)** | нет |
| **Filling-guide modals** | у нас красивая модалка с шагами; у них — только PDF |
| **Audit-log для ROOT** | нет |
| **Mobile + Telegram Mini App** | нет |
| **Дизайн** | их — строгий бумажный, наш — приятный indigo с soft cards |
| **35 vs 30 журналов** | мы покрываем больше |
| **Compliance audit page** | у них нет |
| **Journal templates (cafe-small/restaurant/etc.)** | один-клик-сетап целой орги — у них вручную |

## План правок

### Фаза А — Document Header Block (G1, G7, G9) — основные журналы
1. Создать `<JournalDocumentHeader>` shared компонент. Props:
   - `orgName: string`
   - `title: string` (italic)
   - `pageInfo?: string` — «СТР 1 ИЗ 1» (default)
   - `dateMode?: { startedAt, finishedAt? }` — если задан, рендерится Начат/Окончен вместо СТР
2. Применить в `cleaning-document-client.tsx`, `hygiene-document-client.tsx` (если есть), `brakery-document-client.tsx`, `cold-equipment-document-client.tsx` etc.

### Фаза Б — Print + Legend (G2, G3, G10)
1. `<PrintJournalButton>` shared icon-button → `window.print()` + `@media print` styles в globals.css
2. `<LegendBlock>` shared — italic underlined heading + small text rows с сокращениями
3. Применить в hygiene + cleaning + brakery

### Фаза В — Reference table «Что моется» (G5)
1. В cleaning-document-client сгенерировать справочник из `JournalChecklistItem` per `roomId`:
   - Текущая = items с `frequency === 'daily'`
   - Генеральная = items с `frequency === 'weekly' || 'monthly'`
2. Render под matrix-table как Помещение × Текущая × Генеральная

### Фаза Г — Dictionary management (G6, G8)
1. Audit brakery / deepfat / intensiveCooling — есть ли dictionary CRUD UI?
2. Если нет — добавить «+ Добавить изделие» button + edit modal

### Фаза Д — Auto-fill toggle audit (G4)
1. Audit cleaning UI: где `skipWeekends` toggle exposed?
2. Если не везде — добавить в RoomsModeCard / pairs-mode

## Приоритет

| Приоритет | Что | Польза |
|---|---|---|
| **1 (high)** | G1 Document Header (СИСТЕМА ХАССП block) | Профессиональный вид при проверках РПН |
| **2 (high)** | G2 Print button + print styles | Юзеры реально печатают журналы для проверок |
| **3 (medium)** | G3 Legend block | Чтобы читателю-инспектору было ясно что значат символы |
| **4 (medium)** | G5 Reference table «Что моется» | Бенефит: справочник прямо в журнале |
| **5 (low)** | G6 Dictionary mgmt embedded | Удобство добавления новых изделий |
| **6 (low)** | G8 Recommendations footnote | Дублирует FillingGuide modal — не критично |
