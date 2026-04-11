# HACCP-Online Top Next Ideas

**Date:** 2026-04-07
**Author:** Codex
**Status:** Shortlist of the strongest next product ideas

---

## 1. How To Read This List

Each idea is ranked by:

- product value
- differentiation
- leverage on existing code
- realism for phased implementation

Scores:

- **Impact:** Low / Medium / High / Very High
- **Complexity:** Low / Medium / High
- **Fit now:** how well the feature matches the current state of the repo

---

## 2. Top Shortlist

## 2.1 Shift Mode / Kiosk Mode

**Impact:** Very High  
**Complexity:** Medium  
**Fit now:** Very High

### Why this is strong

The product already wants to live on tablets on the production floor. A dedicated shift mode would make the app much easier to use in real operations:

- крупные кнопки
- быстрый вход по PIN
- список задач на смену
- минимум лишней навигации

### MVP slice

1. отдельный `/shift`
2. сегодняшние обязательные журналы
3. быстрые CTA "заполнить"
4. переключение сотрудника без полного логаута

### Why it fits the repo

- есть PWA
- есть планшетный сценарий в лендинге
- есть журналы, роли и compliance-логика

---

## 2.2 Auto CAPA From Deviations

**Impact:** Very High  
**Complexity:** Medium  
**Fit now:** Very High

### Why this is strong

Сейчас отклонения и CAPA существуют рядом, но не связаны автоматически. Это один из самых ценных продуктовых мостов.

### MVP slice

1. правила: какие отклонения создают CAPA автоматически
2. автосоздание тикета при критичном отклонении
3. SLA и приоритет по типу отклонения
4. ссылка из записи журнала в CAPA и обратно

### Business effect

- меньше потерянных инцидентов
- выше управляемость
- сильнее контроль для технолога и владельца

---

## 2.3 Batch QR Traceability

**Impact:** Very High  
**Complexity:** High  
**Fit now:** High

### Why this is strong

Партии уже есть. Если добавить внутренние QR-коды и нормальную прослеживаемость, модуль партий станет реально сильным и продающим.

### MVP slice

1. генерация QR для партии
2. карточка партии с timeline
3. связь: входной контроль -> партия -> производство -> списание
4. быстрый поиск по QR

### Business effect

- аудит и прослеживаемость
- быстрее расследование инцидентов
- сильная ценность для пищевого производства

---

## 2.4 Evidence Vault

**Impact:** High  
**Complexity:** Medium  
**Fit now:** High

### What it means

Единое хранилище доказательств:

- фото
- сертификаты
- акты
- файлы по CAPA
- вложения к партиям
- документы по поверкам и обучению

### MVP slice

1. прикрепление файлов к CAPA и batch
2. список вложений в карточке сущности
3. базовый доступ и скачивание

### Why it matters

Система станет не только местом записи данных, но и местом хранения проверочной базы.

---

## 2.5 Compliance Calendar / Recurring Tasks

**Impact:** High  
**Complexity:** Medium  
**Fit now:** Very High

### Why this is strong

Многие обязательные действия повторяются:

- генеральные уборки
- поверки
- дезинсекция
- медосмотры
- обучение
- замены ламп

### MVP slice

1. сущность recurring task
2. календарь / список предстоящих задач
3. reminder + overdue status
4. связка с journal document или form entry

### Business effect

- меньше просрочек
- больше ежедневной пользы
- хорошая основа для compliance center

---

## 2.6 Supplier Scorecards

**Impact:** High  
**Complexity:** Medium  
**Fit now:** High

### What to score

- процент брака
- проблемы упаковки
- частота отклонений температуры
- доля просрочки
- возвраты / списания по поставщику

### MVP slice

1. агрегаты по incoming control
2. таблица поставщиков с risk score
3. топ проблемных поставщиков и SKU

### Why it matters

Это превращает журнал приёмки в управленческую аналитику.

---

## 2.7 Recall Mode

**Impact:** High  
**Complexity:** High  
**Fit now:** Medium-High

### What it means

Режим быстрого отзыва продукции:

- какие партии затронуты
- где они использованы
- что уже списано
- что ещё в обороте

### MVP slice

1. ручной запуск recall по batch
2. связанный список affected records
3. export пакета для расследования

### Why later than traceability

Нужен хороший фундамент по batch timeline и связям.

---

## 2.8 Training & Medical Clearance Lifecycle

**Impact:** Medium-High  
**Complexity:** Medium  
**Fit now:** High

### Why this is strong

В репо уже есть `StaffCompetency`, а гигиенические проверки и роли сотрудников уже живут в системе.

### MVP slice

1. сроки действия обучений и медкнижек
2. reminder до истечения
3. статус допуска сотрудника
4. журнал инструктажей как полноценный workflow

### Business effect

- меньше кадровых compliance-рисков
- сильнее HR/QA слой продукта

---

## 2.9 Global Search

**Impact:** Medium-High  
**Complexity:** Low-Medium  
**Fit now:** High

### Search across

- партии
- продукты
- CAPA
- документы
- сотрудники
- журналы

### MVP slice

1. search endpoint
2. глобальная строка в header
3. grouped results with quick links

### Why it is useful

Это быстрая и очень заметная UX-победа без гигантского объёма работ.

---

## 2.10 Audit Package Export

**Impact:** Medium-High  
**Complexity:** Medium  
**Fit now:** High

### What it means

Один экспорт-пакет для проверки:

- PDF журналов
- Excel выгрузки
- вложения
- audit trail
- CAPA по выбранному периоду

### MVP slice

1. фильтр по периоду
2. zip-архив
3. вложить ключевые отчёты и метаданные

### Why it matters

Очень сильная фича для демонстрации ценности на продаже и во время проверок.

---

## 3. Best Order After Current Plan

### If you want the smartest sequence

1. Shift Mode / Kiosk Mode
2. Auto CAPA From Deviations
3. Compliance Calendar / Recurring Tasks
4. Batch QR Traceability
5. Evidence Vault

### If you want the fastest visible wins

1. Global Search
2. Auto CAPA From Deviations
3. Shift Mode / Kiosk Mode
4. Supplier Scorecards
5. Audit Package Export

### If you want the strongest enterprise trajectory

1. Batch QR Traceability
2. Evidence Vault
3. Recall Mode
4. Audit Package Export
5. Training & Medical Clearance Lifecycle

---

## 4. What We Can Realistically Build Tomorrow

## 4.1 Honest answer

**Не всё сразу.**  
Но мы точно сможем за один день сделать **один сильный законченный кусок**, если не распыляться.

### Realistic 1-day scopes

**Option A: Shift Mode MVP**

- новая страница смены
- список обязательных действий на сегодня
- быстрые кнопки перехода в нужные журналы

**Option B: Auto CAPA MVP**

- правила автосоздания CAPA
- создание CAPA из критичных отклонений
- ссылки между журналом и CAPA

**Option C: Global Search MVP**

- единый поиск
- быстрые результаты по основным сущностям
- интеграция в header

**Option D: Evidence Vault MVP**

- вложения для CAPA и batch
- просмотр списка файлов
- базовая загрузка/удаление

---

## 5. Best Practical Recommendation

Если завтра идём вместе в реализацию, я бы выбрал один из этих двух путей:

1. **Сначала стабилизация + document flow**, как в основном implementation plan
2. **Если хочется уже новой сильной фичи после этого — Auto CAPA From Deviations**

Почему именно так:

- это короткий путь к реальной ценности
- почти всё уже подготовлено текущей архитектурой
- эффект сразу заметен и в продукте, и в продажах

---

## 6. Recommendation For Tomorrow Morning

### Best start

1. открыть `2026-04-07-haccp-online-implementation-plan.md`
2. закрыть Phase 0: lint, build, document route
3. после этого сразу перейти к `Auto CAPA From Deviations`

Это самый реалистичный и сильный маршрут на один день.
