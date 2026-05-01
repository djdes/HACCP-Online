# Sprint «Полная настройка под проверку Роспотребнадзора»

**Дата начала:** 2026-05-01
**Логин для теста:** `admin@gavan-copy.test` / `Demo2026!`
**Принцип:** Делаем продуманно, до мельчайших мелочей, для ЛЮБОГО типа
бизнеса (не только маленький прилавок). Все люди мира будут пользоваться.

---

## Точные условия от пользователя

1. **Тип заведения:** прилавок без посадочных мест (тестовая орга),
   но сайт должен быть универсален для всех сценариев — кафе, рестораны,
   столовые, производство, школьные пищеблоки, кейтеринг.

2. **Тестовая организация:** `gavan-copy` — пользователь скоро удалит
   и создаст реальную. Сейчас тестируем + ловим баги.

3. **Удаление сотрудников БЕЗ потери иерархии журналов** — критично:
   - Иерархия по **должностям** остаётся (chips журналов)
   - Если был slot-attached **конкретный человек** → его задача
     попадает в уведомления «Нужно назначить нового, журнал X»
   - Никакая информация не теряется
   - Это новая фича — `archive` вместо `delete` для users + auto-notify

4. **Стратегия настройки:** дополнять только пробелы (вариант "б"),
   НЕ ломать существующее.

5. **TasksFlow подключён** — должен работать.

6. **Бэкфил записей за прошлые дни — НЕТ.** Это фальсификация и
   уголовщина (ст. 327 УК РФ). Только реальные записи с момента
   настройки.

7. **Скрытый гайд в каждой задаче** — для новых сотрудников ТЗ:
   - Что взять (инструменты)
   - Куда пойти
   - Что именно сделать
   - В какой последовательности
   - Что записать
   - Когда задача считается выполненной
   - Common mistakes / на что обратить внимание

8. **Можно создавать любые функции — даже бредовые.** Сайт должен
   быть наполнен. По примеру Telegram: сначала много функций,
   потом отрезать ненужное.

9. **Пушить в разные репы:** WeSetup → `wesetup.ru/HACCP-Online`,
   TasksFlow → `tasksflow.ru/TasksFlow`.

10. **Время неограничено.** Главное — качество и продуманность.

---

## Архитектура решения

### Часть A: Soft-archive юзера + перенос задач в уведомления

**Новая модель:**
- В `User` уже есть `archivedAt: DateTime?` (soft-archive)
- Журнальные responsibles привязаны как:
  - Position-level: `JobPositionJournalAccess` — chip-уровень,
    независимый от user (НЕ ломается)
  - User-level: `Organization.journalResponsibleUsersJson[code][slotId] = userId`
    → этот userId может «осиротеть» если user archived
- ManagerScope.subordinateUserIds — может содержать archived userId

**Что делать при archive:**
1. Найти все journalCode'ы в `Organization.journalResponsibleUsersJson`
   где этот user — slot user
2. Для каждого — установить slot user = `null` (освободить)
3. **Создать notification:** «Сотрудник X уволен. Нужно назначить
   нового на N журналов» — со списком пострадавших + deep-link на
   `/settings/journal-responsibles?fix=...`
4. Та же логика для:
   - WorkShifts (отменить будущие смены этого юзера)
   - ManagerScope.subordinateUserIds (убрать из подчинённых)
   - JobPosition.visibleUserIds (убрать)
   - TasksFlowUserLink (опционально — soft-удалить link, но
     historical задачи остаются)

**API:** `POST /api/staff/:id/archive` (расширение existing) +
`POST /api/staff/:id/unarchive`.

**UI:** в `/settings/users` кнопка «Архивировать» (вместо текущего
delete'а если он есть). Confirm-dialog объясняющий что будет.

### Часть B: Скрытый гайд в каждой задаче

**Концепция:**
- Каждый journal имеет **универсальный гайд** в `journal-specs.ts`
- Новое поле `JournalSpec.fillingGuide` со структурой:
  ```ts
  fillingGuide: {
    summary: string;          // 1-2 предложения «что и зачем»
    materials: string[];      // что взять с собой
    steps: Array<{            // пошаговая инструкция
      title: string;
      detail: string;
      photo?: string;         // опциональная иконка/картинка
    }>;
    completionCriteria: string;  // когда задача считается выполненной
    commonMistakes: string[];    // топ-3 ошибки новичков
    regulationRef: string;       // СанПиН пункт + citation
  }
  ```
- В `DynamicForm` добавляем collapsible блок «📖 Как заполнять»
  ВВЕРХУ формы — разворачивается одним кликом
- В TasksFlow-задаче в description URL включаем deep-link на
  `/journals/<code>/guide` (read-only страница с гайдом)

**Спецификации заполняются вручную для всех 36 журналов** — это
большая прикладная работа но она резко повысит качество данных.

### Часть C: Шаблоны организаций (auto-setup)

**Идея:** `/settings/onboarding-template` — выбираешь тип заведения,
один клик и всё настроено:
- **Прилавок** (10-20 м², 2-3 сотрудника): минимальный набор журналов
- **Кафе 30 мест** (5-8 сотрудников): + бракераж + расширенная уборка
- **Ресторан 100 мест** (15-25 сотрудников): + полный пакет ХАССП
- **Столовая школьная** (10-15 сотрудников): + ужесточённые требования
  СанПиН для детских учреждений
- **Производство** (20+ сотрудников): + traceability + аудиты

**Что создаётся:**
- JobPositions (типичный набор для типа)
- Areas + Equipment (placeholders)
- Включённые journal codes
- Default responsibles (slot users = null, position-chips настроены)
- Default task-modes
- Notification «Шаблон применён, теперь заполни сотрудников»

### Часть D: «Готовность к проверке Роспотребнадзора»

**Страница:** `/dashboard/compliance-audit` (или раскрывающаяся секция).

**Чек-лист:**
1. Структура (буildings + areas + equipment — есть всё нужное?)
2. Команда (на каждой обязательной должности минимум 1 человек?)
3. Журналы (все обязательные включены? у каждого есть responsible?
   у responsible есть TF-привязка?)
4. Записи за 7 дней (по каждому журналу: есть ли?)
5. CAPA (открытых аномалий > 7 дней?)
6. Документы (документы созданы на текущий месяц?)

**Score из 100** — взвешенная сумма checks.

**Кнопки fix-now на каждый пункт** — переход куда нужно.

### Часть E: Дополнения и dolg (бредовые фичи которые могут стать конфеткой)

1. **«Журнальный календарь»** — `/dashboard/calendar` — по дням видно
   что заполнено / просрочено, как Google Calendar но для compliance
2. **«Журнал-репетиция»** — режим guided-tour для нового сотрудника:
   open журнал, гайд во весь экран, симулирует реальную задачу
3. **«Сотрудник-эмодзи»** — каждому юзеру свой emoji (👨‍🍳, 🧹, 📋) —
   в списках задач легче find'ить
4. **«Анонимная жалоба»** — `/feedback/anonymous` — повар может
   пожаловаться на условия, на менеджера, не светясь
5. **«Кнопка SOS»** — при ЧП (пожар/травма/отравление) — single tap
   создаёт accident_journal, отправляет SMS управляющему,
   фиксирует время
6. **«Голосовой бракераж»** — повар диктует «Цвет хороший, запах
   норм, температура 72» — Whisper транскрибирует в форму
7. **«AI-аналитик»** — в конце дня админ получает summary через
   GPT: «Сегодня заполнено 87%. Основные риски: ...»
8. **«Печать в подвал»** — раз в год кнопка «Печать всех журналов
   за год в один PDF» (для физического хранения, как требует
   СанПиН для крупных производств)

---

## Сейчас уже сделано (рекап)

- ✅ Phase 0-7: rolling distribution, time-window alerts, deep-link
  notifications, recommendation в hint, fan-out fix scope, dryRun
  preview, dashboard collapsible, task-visibility, demote isAdmin
- ✅ Pipeline finished_product (4 шага)
- ✅ Conditional required fields
- ✅ Cross-journal traceability (batchKey)
- ✅ ConfirmDialog везде вместо window.confirm

---

## Порядок этого спринта

### Шаг 1 — Reconnaissance + diff
Через Playwright логин в гавань-копи. Снять снимок:
- Whats currently configured: positions, users, journals, responsibles
- Что НЕ настроено

### Шаг 2 — Часть A: Soft-archive с auto-notify
1. Расширить `POST /api/staff/:id/archive` — после archive искать
   все journal slots где userId = archived и nullify
2. Создать `notifyManagement` с kind='staff.archived.responsibles_orphan'
3. UI в /settings/users — кнопка «Архивировать» с ConfirmDialog'ом
4. Тест: архивирую тестового сотрудника → notification приходит,
   slot null'ится

### Шаг 3 — Часть B: Скрытый гайд
1. Расширить `JournalSpec` с `fillingGuide` (опциональным)
2. Заполнить guides для топ-15 самых частых журналов:
   hygiene, health_check, cold_equipment_control, climate_control,
   cleaning, finished_product, incoming_control, perishable_rejection,
   intensive_cooling, fryer_oil, disinfectant_usage, uv_lamp_runtime,
   med_books, ppe_issuance, staff_training
3. UI в `DynamicForm` — collapsible сверху «📖 Как правильно заполнить»
4. UI в FinishedProductPipeline — на каждом шаге свой шаг гайда
5. URL `/journals/<code>/guide` — standalone read-only страница

### Шаг 4 — Часть C: Onboarding templates
1. lib/onboarding-templates.ts — 5 пресетов
2. POST /api/settings/onboarding-template { type } — создаёт всё
3. UI /settings/onboarding-template — карточки выбора
4. После применения — redirect на `/settings/users` с пустым штатом
   и предложением заполнить

### Шаг 5 — Часть D: Compliance audit страница
1. lib/compliance-audit.ts — расчёт score
2. /dashboard/compliance-audit — страница с чек-листом
3. Виджет на дашборде с кратким Score

### Шаг 6 — Применить к тестовой компании gavan-copy
1. Через Playwright (или прямые DB-инcerts) пройти весь setup:
   - Buildings (1) + Rooms (8)
   - Equipment (10)
   - JobPositions (10) — управление + производство + поддержка
   - Users (5-7 demo)
   - JobPositionJournalAccess (37 journals × ~3 positions = chips)
   - Responsibles (для каждого journal — slot users)
   - Task-visibility — Админ выбран
   - WorkShifts на сегодня и следующие 7 дней
2. Прокликать Compliance audit → должен быть 90%+
3. Превью отправки задач → все ready, нет blocked
4. Submit реальный bulk-assign → задачи уходят на TF

### Шаг 7 — Bonus: бредовые фичи (1-2 на выбор)
- AI-аналитик summary в конце дня (если успеваю)
- Кнопка SOS (легко делается + полезно)
- «Журнальный календарь» (если время есть)

---

## Critical principles

1. **Каждое изменение в WeSetup → commit + push в WeSetup repo.**
   Каждое изменение в TasksFlow → push в TasksFlow repo.
2. **Никаких window.confirm** — везде ConfirmDialog/confirmAsync.
3. **Любая новая UI-кнопка** → согласно §6 CLAUDE.md (рекомендации,
   live-preview, design-system).
4. **WhatsNewModal** — обновлять SHA после каждого крупного pull
   request'а.
5. **Все задачи юзера = новые функции, не только баг-фиксы.**
6. **Никаких backfill записей** — это фальсификация.

---

## Заметки для будущего меня (если context закончится)

После compaction'а — открой этот файл, прочитай и продолжай с
следующего невыполненного шага. Прогресс отмечу в этом файле как
checkboxes.

### Чек-лист прогресса

- [ ] Шаг 1 — Reconnaissance gavan-copy
- [ ] Шаг 2A — soft-archive endpoint
- [ ] Шаг 2B — soft-archive UI
- [ ] Шаг 2C — auto-notify orphan slots
- [ ] Шаг 3A — fillingGuide в JournalSpec
- [ ] Шаг 3B — guides для 15 журналов
- [ ] Шаг 3C — UI в DynamicForm
- [ ] Шаг 3D — URL `/journals/<code>/guide`
- [ ] Шаг 4 — onboarding-template
- [ ] Шаг 5 — compliance-audit
- [ ] Шаг 6 — настройка gavan-copy через Playwright
- [ ] Шаг 7 — bonus features

Каждый раз когда заканчиваю шаг — отмечаю ✓ в этом файле + коммит
с message «sprint-compliance: step N done».
