# WeSetup — Features & Automation Roadmap

> **Файл-инструкция для будущих сессий Claude.** Если ты только зашёл в проект — прочитай этот файл целиком, выбери ОДНУ задачу из «Pending tasks», реализуй её, запушь в прод (см. workflow ниже) и удали её из этого файла тем же коммитом. Не делай несколько задач за раз — лучше одна выкаченная и протестированная, чем три полу-готовые.

## 0. Project context (read first)

**WeSetup** — Next.js 16 SaaS для электронных журналов СанПиН и ХАССП на пищевых производствах (рестораны, пекарни, мясокомбинаты, школьные столовые, тёмные кухни). Работает в связке с **TasksFlow** (отдельное Express+React приложение по адресу `c:\www\TasksFlow`, репо `djdes/TasksFlow`, домен `tasksflow.ru`) — TF используется как «mobile-first» очередь задач для рядовых сотрудников.

### Stack
- **Frontend/Backend:** Next.js 16 App Router, TypeScript strict, Tailwind, shadcn/ui, Prisma ORM, PostgreSQL.
- **Auth:** NextAuth.js 4 (JWT), Telegram-провайдер для Mini App.
- **Telegram:** grammy framework, bot `@wesetupbot`, webhook + Mini App.
- **AI:** `@anthropic-ai/sdk` v0.78, модели `claude-haiku-4-5-20251001` (чат) и `claude-opus-4-7` (тяжёлые задачи). Env: `ANTHROPIC_API_KEY`.
- **IoT:** `@tuya/tuya-connector-nodejs` для Tuya-датчиков. Env: `TUYA_BASE_URL`, `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET`.
- **Email:** Resend. Env: `RESEND_API_KEY`.
- **PDF:** jspdf + jspdf-autotable.
- **Deploy:** GitHub Actions `.github/workflows/deploy.yml` → push в `master` → SSH в `wesetup.ru`, restart PM2-процесса `haccp-online` на порту 3002.
- **Cron:** ВНЕШНИЙ scheduler (cron-job.org или server crontab) дёргает `GET /api/cron/<name>?secret=$CRON_SECRET`. У Vercel-style cron'ов нет — runtime self-hosted.

### Структура папок (ключевое)

```
src/
  app/
    (auth)/      — login, register, invite (публичные)
    (dashboard)/ — /journals, /dashboard, /settings (NextAuth-protected)
    (root)/      — ROOT-only platform pages (/root/*)
    mini/        — Telegram Mini App
    inspector/   — public read-only портал инспектора (token-auth)
    task-fill/   — public fill-form для TasksFlow задач (HMAC-token)
    api/
      cron/      — все cron-routes; защита через ?secret=$CRON_SECRET
        compliance/    — ежедневное напоминание о пропущенных журналах
        expiry/        — алерт о приближении сроков годности
        mini-digest/   — ежедневная сводка для воркеров
        tuya-pull/     — почасовая синхронизация датчиков (HOURLY)
        weekly-digest/ — понедельничная сводка для управления
      ai/sanpin-chat/  — POST chat-помощника по СанПиН/ХАССП
      external/        — публичный API для IoT-датчиков (token-auth)
      inspector/       — public PDF endpoint
      integrations/tasksflow/  — sync, bulk-assign, webhooks
      task-fill/       — submit handler для public task-fill page
  lib/
    tasksflow-adapters/  — адаптеры журналов под TasksFlow задачи
    tuya.ts              — Tuya API клиент
    inspector-tokens.ts  — генерация/хеш read-only токенов
    onboarding-presets.ts — пресеты по типу заведения
    today-compliance.ts  — расчёт «выполнено сегодня»
    telegram.ts          — bot helpers (sendMessage, notifyOrganization)
    pdf.ts, document-pdf.ts — PDF-генерация
prisma/schema.prisma     — единый файл схемы (~1100 строк)
docs/                    — этот файл и архитектурные планы
```

### Соглашения проекта

- **Коммиты на русском.** После каждого коммита `git push origin master`. Формат: краткое описание, без эмоджи в первой строке. Расширенный body с «что/зачем/как» допустим.
- **Не свайпать локальные scratch-файлы** в коммиты. Стейджить конкретные пути: `git add path/to/file1 path/to/file2`.
- **Type-check перед коммитом:** `npx tsc --noEmit --skipLibCheck`. Должно быть пусто.
- **Lint:** `npm run lint`. Должно быть пусто.
- **Build не обязателен локально** — deploy.yml делает на сервере.
- **Prisma:** при изменении schema — `npx prisma generate` чтобы перегенерить клиент. На сервере `prisma db push` отрабатывает в deploy.yml.
- **Skills (см. `.claude/skills/`):** перед UI-правками — `wesetup-design`, перед бизнес-логикой — `superpowers:brainstorming`, перед debug — `superpowers:systematic-debugging`. Используй их прежде чем кодить.
- **Auto-memory** (`.claude/projects/c--www-Wesetup-ru/memory/`): читай при старте, пиши при получении standing-instructions от пользователя.

### Production endpoints
- **Site:** https://wesetup.ru
- **Path:** `/var/www/wesetupru/data/www/wesetup.ru/app`
- **PM2 process:** `haccp-online` на порту 3002
- **SSH (для проверки логов):** `wesetupru@wesetup.ru:22` пароль `bCQMn~Jy9C-n&9+(`. Команда:
  ```bash
  plink -batch -hostkey "ssh-ed25519 255 SHA256:NwU1dGS29JAjs2K5LfEtu3DLFgg04yo7ZEA4iOGkM6E" -P 22 -l wesetupru -pw 'bCQMn~Jy9C-n&9+(' wesetup.ru "pm2 logs haccp-online --lines 50 --nostream --err"
  ```

### TasksFlow context

Для задач, затрагивающих TF — отдельный repo `c:\www\TasksFlow`. Стек: Vite + React + Express + Drizzle + MySQL/Postgres. Деплой через `npm run build` + custom SSH workflow. Branch — `main` (не `master`). Коммиты тоже на русском, после коммита `git push origin main`.

---

## 1. Workflow для Claude

Каждая задача из «Pending tasks» имеет:
- **Title** — короткое имя
- **Goal** — что считается «сделано»
- **Сложность** — S / M / L / XL (приблизительная оценка времени)
- **Hints** — куда смотреть, какие файлы трогать
- **Acceptance** — формальные критерии готовности

**Workflow:**

1. Прочитай этот файл целиком.
2. Выбери задачу из «Pending tasks» — приоритизируй по верхней категории + меньшей сложности при прочих равных.
3. Если задача неясная или требует архитектурных решений — invoke `superpowers:brainstorming` skill для уточнения scope, прежде чем кодить.
4. Реализуй её. Используй `TodoWrite` для tracking прогресса в процессе.
5. **Type-check** + **lint** перед коммитом.
6. Коммит на русском с body `что/зачем/как`. **Сразу `git push origin master`** (или `main` для TasksFlow).
7. Тем же коммитом — **удали выполненную задачу из этого файла**, перенеси её краткой строкой в «Recently shipped» с датой и SHA коммита.
8. Если по ходу работы нашёл побочные баги — НЕ чини их в этом коммите, занеси новой задачей в этот файл с пометкой `[discovered]`.
9. Если задача оказалась XL и ты её разбил — оставь parent-задачу в файле, добавь `[partial: <что-сделано>]` пометку, не удаляй до полного закрытия.

---

## 2. Recently shipped (не делать заново)

| Дата | SHA | Что |
|---|---|---|
| 2026-04-26 | `ec1ef75` | Tuya auto-pull cron — `/api/cron/tuya-pull` пишет t°/влажность с датчиков в `cold_equipment_control` и `climate_control` без юзера |
| 2026-04-26 | `6ba17c8` | Inspector portal — `InspectorToken` модель, `/inspector/<token>` read-only с TTL и one-click PDF, `/settings/inspector-portal` UI |
| 2026-04-26 | `3cb8af3` | Setup-wizard расширение — `/api/onboarding/apply` теперь применяет `disabledJournalCodes` + `autoJournalCodes` + опциональная смена `Organization.type`; UI получил селектор типа |
| 2026-04-26 | `9113154` | Weekly Telegram digest — `/api/cron/weekly-digest` шлёт менеджерам компактное HTML-сообщение каждый понедельник с compliance %, top employee, bottom-3 пропускаемых журналов, TF stats |
| 2026-04-26 | `8053d48` | AI SanPiN/ХАССП помощник — floating-FAB на дашборде → `/api/ai/sanpin-chat` с Claude Haiku 4.5 system-prompt'ом про ТР ТС/СанПиН; история в localStorage |
| 2026-04-26 | `8a2b54a` | Демо-данные для ROOT — `POST /api/root/seed-demo-org` создаёт за 30 сек полную trial-организацию: positions + journals + 10-20 demo-сотрудников + JournalDocument на месяц + 7 дней history. Кнопка «Создать демо-ресторан» на `/root` |
| 2026-04-26 | `da78661` | Fuzzy-match должностей при bulk-импорте — chained-strategy: exact → alias-table (~70 RU-вариаций) → levenshtein ≤2 → substring. `POST /api/settings/positions/match` для wizard'а, интегрировано в `/api/staff/bulk` (autoMatched в response, hint «возможно, имели в виду» при miss). 90% строк не требуют ручного выбора |
| 2026-04-26 | `a5a6bcd` | Drag-and-drop импорт Excel/CSV — `BulkStaffImport` принимает .xlsx / .xls / .csv / .tsv через drop-zone или file picker. Lazy-import `xlsx`, auto-detect разделителя CSV, auto-mapping колонок по заголовкам (фио/должность/телефон), превью первых 5 строк с бейджами «→ ФИО», dropdown'ы для ручной коррекции маппинга. Paste-textarea остался как fallback в `<details>`. Сочетается с fuzzy-match (#3.1.2) — 50 сотрудников из iiko-экспорта импортятся за один тап |
| 2026-04-26 | `ea295b1` | QR-quick-fill для оборудования — `/equipment-fill/[id]` (на которое ведёт QR-наклейка) теперь читает `Equipment.sensorMappings` и для оборудования с climate-mapping (humidity) показывает доп. поле «Влажность %». POST API при наличии humidity записывает в active climate_control document с автоопределением ближайшего controlTime. Холодильники без climate-mapping продолжают работать как раньше (только температура) |
| 2026-04-26 | `1b8ae20` | «Заполнить как вчера» в task-fill — `GET /api/task-fill/[id]/yesterday-prefill` возвращает `entry.data` за вчера (DocumentEntry-based журналы: hygiene/health_check/cold_equipment/climate). Кнопка появляется автоматически когда хотя бы одно поле формы совпадает с ключами вчерашних данных; на клик — pre-fill всех совпавших полей, юзер правит только что изменилось |
| 2026-04-26 | `8abe3b5` | Smart defaults в task-fill formах — helper `src/lib/smart-defaults.ts` (`getYesterdayEntryData`, `getRecentEquipmentReading`). Hygiene и health-check adapter'ы при `getTaskForm` автоматически подгружают вчерашние status/signed и подставляют как `defaultValue`. Повар привычно ставит «healthy» каждый день → форма уже pre-filled, один тап submit |
| 2026-04-26 | `7bf3088`–`378ace0` | **EPIC: Shared journal tasks (event-log) + кнопка «Не требуется сегодня».** Большая переделка интеграции TF: 35 шаблонов классифицированы по `taskScope: personal \| shared`. Shared (acceptance, finished_product, complaint_register, accident_journal и 16 других event-журналов) теперь работают как открытая очередь записей: сотрудник может N раз нажать «Добавить запись», или «Не требуется сегодня» с выбором причины из настроенного списка. Compliance признаёт closure ✅. В TF появились 3 таба «Все / Мои задачи / Общие задачи смены». Реализовано в 9 коммитов: WeSetup `7bf3088` schema → `90e3b88` backend API → `1792ee8` классификация шаблонов → `c4ab75f` settings UI per-template → `c001196` compliance recognition → `4bba603` task-fill page UI с 3 кнопками → `23f0658` auto-close cron + roadmap → `8a0bbe9` shiftEndHour UI + taskScope в journalLink; TasksFlow `378ace0` 2-табовый Dashboard. Cron'ы для прода: `/api/cron/migrate-task-scopes` (раз после деплоя), `/api/cron/auto-close-shifts` (ежечасно). |

---

## 3. Pending tasks

### 3.1. Onboarding нового ресторана за 1 день

#### 3.1.4. Sandbox / 14-day trial
- **Goal:** свежезарегистрированная org получает `subscriptionPlan: "trial"` (уже есть!) с soft-лимитами: 50 записей/день, max 3 активных Tuya-датчика, AI-чат 20 сообщений. По истечении 14 дней — модалка «продлить или сократить функционал».
- **Сложность:** M
- **Hints:** добавить middleware-проверку лимита перед write-операциями. Для AI — см. идею «free-tier rate-limit» ниже.
- **Acceptance:** на 15-й день trial-org видит upgrade-CTA на дашборде, но журналы не блокируются (read-only fallback вместо hard-stop).

### 3.2. Заполнение журналов «дурак-проф»

#### 3.2.1. Voice input через Telegram-бот
- **Goal:** в Telegram-боте появляется voice-кнопка «Заполнить голосом». Сотрудник наговаривает «уборка холодильника номер три выполнена», bot транскрибирует через `whisper-1` API (через OpenAI или Anthropic-альтернативу), мэпит на ближайший pending journal-task и отмечает выполнение.
- **Сложность:** M
- **Hints:** OpenAI Whisper API ($0.006/min). Telegram bot voice messages — `audio.voice` через grammy. Структурирование транскрипта в action — Claude Haiku one-shot.
- **Acceptance:** на 8 из 10 типичных команд («моя смена закончена», «t° в кондитерской 4 градуса», «уборка зала готова») bot правильно отмечает целевой journal-cell.

#### 3.2.3. Geofence-напоминания
- **Goal:** при входе сотрудника в радиус кухни (по `Area.lat/lng`) — Telegram push «Иван, утренняя hygiene — 30 сек».
- **Сложность:** M
- **Hints:** Mini App уже имеет geo через Telegram WebApp API. Нужен background-watcher (нельзя в WebView надолго) ИЛИ периодический опрос location при открытии Mini App + сравнение с Area.lat/lng. Альтернатива — native PWA с Geolocation API + push.
- **Acceptance:** сотрудник в Mini App, который проходит мимо своей кухни — получает Telegram push с deep-link на нужный journal-task.

#### 3.2.6. Photo OCR для incoming-control
- **Goal:** в форме приёмки сырья кнопка «Сфотографировать чек». Фото → Claude Vision → распарсить дату, срок годности, массу, поставщика.
- **Сложность:** L
- **Hints:** уже есть `/api/ocr/label` для маркировок продукции — переиспользовать паттерн. system-prompt: «извлеки JSON {productName, weight, deliveryDate, expiryDate, supplier}».
- **Acceptance:** сотрудник снимает чек → через 3 сек 5 полей формы заполнены автоматически с возможностью править перед save.

### 3.3. Multi-location / франшизы

#### 3.3.1. Network organization (parent → children)
- **Goal:** в `Organization` добавить `parentOrganizationId`. ROOT может назначить сеть. Управляющий сетью видит aggregate-compliance всех точек на отдельной /network странице.
- **Сложность:** L
- **Hints:** prisma migration. Все query которые `where: { organizationId }` — расширить до `OR: [{ organizationId }, { organization: { parentOrganizationId } }]` через специальный helper. Не ломать tenant isolation.
- **Acceptance:** регистрация new-child-org с указанием parent → она появляется в /network page материнской org, compliance считается агрегатом.

#### 3.3.2. Шаблоны journals между компаниями
- **Goal:** менеджер сети редактирует «Журнал контроля интенсивного охлаждения» с custom-полями (список блюд) → жмёт «Распространить на все точки сети» → 50 точек получают обновлённый config через Notification + автозапись в их `JournalDocument.config`.
- **Сложность:** M
- **Hints:** требует наличия #3.3.1 (parent-org). На уровне UI — diff-preview: «вот что изменится в N точках».
- **Acceptance:** redeploy конфига в 50 точек за <30 сек, история изменений видна в audit log.

#### 3.3.3. Cross-location бенчмаркинг
- **Goal:** на /network page — таблица «Точка / compliance% / худший журнал / цвет». Сортировка по compliance ASC — региональный директор видит проблемные точки сверху.
- **Сложность:** M
- **Hints:** переиспользовать `getTemplatesFilledToday` для каждой child-org за период. Кеш на 1 час, чтобы не grind базу при открытии.
- **Acceptance:** /network/benchmark открывается за <2 сек для сети из 100 точек.

#### 3.3.4. Маркетплейс конфигураций
- **Goal:** успешные рестораны могут опубликовать свой набор `disabledJournalCodes + autoJournalCodes + jobPositions` под лицензией CC. Новая компания при онбординге видит «топ-10 публичных конфигов» и может импортировать.
- **Сложность:** L
- **Hints:** новая модель `OnboardingPresetPublished`. UI — `/marketplace`. Социальный proof.
- **Acceptance:** менеджер новой компании видит preset «Кофейня Surf Coffee — 12 точек», нажимает «Применить» → конфиг применяется как onboarding-preset.

### 3.4. Инспектор / аудитор / СЭС

#### 3.4.1. Бумажная распечатка всего за период (async)
- **Goal:** в `/settings/inspector-portal` или отдельной странице — кнопка «Сформировать полный архив за период». Формирует ZIP со всеми journal-PDF файлами + summary, асинхронно через background job. Ссылка на скачивание + email-уведомление когда готово.
- **Сложность:** M
- **Hints:** уже есть `/api/inspector/[token]/pdf` (summary). Тут — full-archive: для каждого active document вызвать `/api/journal-documents/[id]/pdf` → собрать в ZIP через `archiver`. Storage — `/var/www/.../tmp` с TTL 7 дней.
- **Acceptance:** на 100-документной orgе архив генерится за <5 мин в background, email с ссылкой приходит, ZIP скачивается, валидный.

#### 3.4.2. Электронная подпись инспектора
- **Goal:** в портале инспектора (`/inspector/<token>`) — кнопка «Подтверждаю просмотр». Записывает `InspectorVisit` row с timestamp + IP + user-agent + список просмотренных templates.
- **Сложность:** L
- **Hints:** новая модель `InspectorVisit { tokenId, signedAt, ip, userAgent, templatesViewed Json }`. UI — отдельная "signed" badge на токене у админа.
- **Acceptance:** admin видит «Инспектор Иванова И.И. подписала просмотр 2026-04-30 14:30, журналов: 12».

#### 3.4.3. Compliance-сертификат
- **Goal:** PDF с QR-кодом «такая-то организация ведёт журналы N дней без нарушений». Можно вешать в зале клиенту.
- **Сложность:** S
- **Hints:** новая роута `/api/certificate/<orgId>?from=&to=`. Генерит PDF через jspdf, QR — через `qrcode` lib. QR ведёт на `/inspector/<token>` (TTL 90 дней) с фиксированным периодом — третьи лица могут проверить.
- **Acceptance:** ресторан скачивает PDF, печатает A4, вешает в зале — QR работает с любого смартфона.

### 3.5. Staff lifecycle

#### 3.5.1. Onboarding-чек-лист нового сотрудника
- **Goal:** новый `User` получает серию задач (через `Notification` + `JournalObligation`): пройти инструктаж по гигиене, медкомиссия, расписаться в правилах. Менеджер не может «допустить» сотрудника к смене, пока чек-лист не закрыт.
- **Сложность:** M
- **Hints:** новая модель `OnboardingChecklist` или переиспользовать `JournalObligation`. Hard-gate в TasksFlow assigment.
- **Acceptance:** при создании user'а ему приходит TG с 5 задачами, после закрытия всех — статус `User.onboardingComplete = true`.

#### 3.5.2. Уведомления при выходе сотрудника
- **Goal:** если в WorkShift сотрудник на смене, но за 30 минут от старта он ничего не отметил в journals — push менеджеру «Иван на смене?». После порога 2 часа — авто-обновление WorkShift с пометкой `absent`.
- **Сложность:** M
- **Hints:** новый cron `/api/cron/shift-watcher` каждые 30 мин. Сравнивает `WorkShift.startTime` с journal activity.
- **Acceptance:** менеджер получает 1 push за смену с реальной информацией, не false-positives при выходных.

#### 3.5.3. Учёт обучения (медкнижка expiry)
- **Goal:** в `StaffCompetency` есть поле expiry. Дёргать `/api/cron/expiry` (уже есть для продуктов!) расширить — за 30/14/3 дня до expiry медкнижки → push менеджеру.
- **Сложность:** S
- **Hints:** одна модификация `/api/cron/expiry` route.
- **Acceptance:** за месяц до истечения медкнижки Иванова менеджер видит push «Иванов — медкнижка 2026-05-26 (через 30 дней)».

#### 3.5.4. Автоматический offboarding
- **Goal:** админ деактивирует user'а → автоматически: TF задачи передаются преемнику (по jobPosition), telegram chat unlinks, email уведомление admin'у со списком текущих обязательств.
- **Сложность:** M
- **Hints:** хук в API `/api/users/[id]` PATCH когда `isActive` меняется на false. Использовать существующий `pickPrimaryStaff` для подбора преемника.
- **Acceptance:** деактивация повара Иванова → в TF его 8 задач переходят на повара Петрова (та же должность), audit log пишет «8 tasks reassigned».

### 3.6. IoT / физический мир

#### 3.6.1. Поддержка ESP32/Arduino (DIY-датчики)
- **Goal:** опубликовать `/api/external/sensors POST {orgToken, equipmentId, type, value}` с публичной документацией. Маркетплейс готовых прошивок для ESP32 на GitHub.
- **Сложность:** M
- **Hints:** уже есть `/api/external/entries` с per-org token. Расширить или новый sensor-specific endpoint. README с пример Arduino-кода.
- **Acceptance:** студент берёт ESP32 за $5, заливает прошивку из README, привязывает к Equipment в admin → датчик пишет t° автоматически.

#### 3.6.2. Bluetooth-термометры через PWA Web Bluetooth
- **Goal:** в Mini App кнопка «Подключить термометр». Web Bluetooth API ловит замер с Testo 104/Hanna HI 145 и кладёт в форму.
- **Сложность:** L
- **Hints:** Web Bluetooth работает только в Chrome (но Chrome ≥ 80% mobile share в RU). Нужен mapping характеристик GATT-сервиса на каждую модель.
- **Acceptance:** повар нажимает кнопку → разрешает Bluetooth → термометр пишет 4.2°C → поле формы pre-filled.

#### 3.6.3. Trigger при отклонении от нормы → CAPA
- **Goal:** датчик показал t° > 6°C 30 минут подряд → push менеджеру + автосоздание `CapaTicket` со ссылкой на эпизод.
- **Сложность:** M
- **Hints:** `CapaTicket` уже есть. Хук в `/api/cron/tuya-pull` — если value out of `Equipment.tempMin..tempMax` > N подряд → создать ticket.
- **Acceptance:** холодильник зашкалил на 2 часа → менеджер получил push + в `/capa` появился новый ticket «Превышение t° холодильник №3 / 2026-04-26 14:00-16:00».

#### 3.6.4. Vision AI для сканирования полок
- **Goal:** сотрудник снимает 1 фото холодильника → AI выделяет видимые продукты + распознаёт даты на ценниках/упаковке → проверяет на просрочки → пишет в `losses`.
- **Сложность:** XL
- **Hints:** Claude Vision на одном фото — точность ~70% на дату/название. Рекомендую делать pilot на 5 ресторанах перед раскаткой. Risk: false-positives → менеджер не доверяет.
- **Acceptance:** для пилотного ресторана с 5 фото в неделю — 80% реальных просрочек найдены, < 2 false-positives.

### 3.7. Аналитика и operational insight

#### 3.7.1. Heatmap compliance
- **Goal:** на дашборде менеджера — календарь, ось X = дни, ось Y = journals, цвет ячейки от красного (0%) до зелёного (100%).
- **Сложность:** M
- **Hints:** переиспользовать `getTemplatesFilledToday` для каждого дня периода (7-30 дней). Render — `recharts` или собственный SVG. Кешировать 1 час.
- **Acceptance:** менеджер сразу видит «у нас завал по health_check каждый понедельник» — паттерн читается с одного взгляда.

#### 3.7.2. Predictive alerts
- **Goal:** «если сегодня к 14:00 не заполнено N — статистика говорит 80% что не заполнят сегодня вообще, напомним сейчас».
- **Сложность:** L
- **Hints:** простой baseline без ML — посчитать historical % заполнения в 14:00 vs final за день для каждого journal-template. Если delta < threshold → push.
- **Acceptance:** push приходит ровно когда (а) статистически плохо, (б) ещё успеть исправить — не за 5 минут до конца дня.

#### 3.7.3. Time-to-fill метрика
- **Goal:** для каждого journal — медианное время заполнения (от open form до submit). На дашборде ROOT — топ медленных журналов в платформе.
- **Сложность:** S
- **Hints:** новый `JournalEntryTiming` table или просто `entry.metadata.formOpenedAt` поле. Считать в API submit handler.
- **Acceptance:** видим что hygiene заполняется за 12 сек, climate — за 90 сек. Climate-форма явно требует UX-упрощения.

#### 3.7.4. Worker-leaderboard
- **Goal:** на странице `/dashboard` — карточка «Топ-3 исполнителя за месяц» по числу записей + бонус-сумма.
- **Сложность:** S
- **Hints:** `BonusEntry` уже есть. UI-only задача с парой запросов.
- **Acceptance:** видна геймификация — повар Сидоров заполнил 234 записи и получил +1500₽ бонусов в апреле.

### 3.8. LLM/AI features

#### 3.8.1. Auto-generation отчётов по журналам
- **Goal:** менеджер на странице `/reports` нажимает «Сгенерировать отчёт за апрель» → Claude получает summary всех journals + проблем → выдаёт текстовый отчёт «вот что было хорошо, вот проблемы, вот рекомендации».
- **Сложность:** S
- **Hints:** одна Claude Sonnet ($3/$15) или Haiku ($0.8/$4) ручка. ~5K токенов на отчёт = $0.05. Кешировать готовые отчёты в БД.
- **Acceptance:** менеджер тратил 2 часа на отчёт собственнику — теперь 10 секунд + правки.

#### 3.8.2. Smart copy-paste из ТТК/SOP
- **Goal:** менеджер вставляет процедуру производства (текст SOP/ТТК) → AI разбивает на критические контрольные точки (CCP) и предлагает места контроля.
- **Сложность:** L
- **Hints:** Claude Sonnet с system-prompt'ом про ХАССП. Может промахиваться — нужен review-flow с возможностью править перед сохранением.
- **Acceptance:** ТТК «Котлета по-киевски» → AI выдаёт 5 CCP (приёмка, разделка, t° готовности, охлаждение, хранение) с предложениями журналов.

#### 3.8.3. Подсказки CAPA при нарушениях
- **Goal:** когда `CapaTicket` создаётся (вручную или из IoT-trigger) — кнопка «AI: предложить корректирующие действия». Claude получает контекст + историю и выдаёт 3 варианта.
- **Сложность:** M
- **Hints:** один short-prompt запрос с context из ticket. ~2K токенов = $0.002.
- **Acceptance:** в форме CAPA менеджер нажимает кнопку → 3 варианта в ≤30 сек, может выбрать один и отредактировать.

#### 3.8.4. RAG для AI-помощника по СанПиН
- **Goal:** уже есть базовый AI чат. Добавить embeddings всех релевантных нормативов (ТР ТС 021/022, СанПиН 2.3/2.4.3590-20, СП 2.4.3648-20, ГОСТ Р 51705.1) → ответы со ссылками на конкретные пункты.
- **Сложность:** M
- **Hints:** OpenAI text-embedding-3-small ($0.02/1M токенов) для эмбеддингов. Storage — pgvector в Postgres (уже есть Postgres!). Нормативы — ~200 страниц, ~600K токенов = $0.012 одноразово. Retrieval top-5 chunks → подставить в system-prompt.
- **Acceptance:** на вопрос «какая t° холодильника?» AI отвечает «Согласно п. 4.5 СанПиН 2.3/2.4.3590-20: +2…+6 °C» с цитатой непосредственно из норматива.

#### 3.8.5. Free-tier rate-limit для AI-чата
- **Goal:** добавить `Organization.aiMonthlyMessagesLeft Int @default(20)`, декремент в `/api/ai/sanpin-chat` route. При 0 — 402 + upgrade-CTA в виджете. Сброс каждое 1-е число cron'ом.
- **Сложность:** S
- **Hints:** prisma migration. Виджет показывает «осталось N» внизу.
- **Acceptance:** trial-org получает 20 сообщений в первый месяц, после — модалка «Pro $20/mo за безлимит». Twoja себя не разоряет на API-токены.

#### 3.8.6. Prompt caching для AI-чата
- **Goal:** в `/api/ai/sanpin-chat` system-prompt подаётся через Anthropic prompt-caching API (`cache_control: { type: "ephemeral" }`). Снижает стоимость input-токенов в 10× при повторном обращении в течение 5 мин.
- **Сложность:** S
- **Hints:** см. https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching. Меняем 2 строки в API route. System-prompt у нас ~600 токенов — каждое cached-обращение экономит ~$0.0005 по сравнению с full input.
- **Acceptance:** второе сообщение от того же юзера в течение 5 мин стоит на 90% дешевле первого, в headers ответа Claude видим `cache_read_input_tokens > 0`.

### 3.9. Интеграции

#### 3.9.1. iiko / Poster / r_keeper
- **Goal:** заказы и блюда из POS (iiko-Office API) → синк в `finished_product` журнал автоматически каждые 30 мин.
- **Сложность:** L
- **Hints:** iiko API имеет /api/0/login + /api/0/olap. POS-плагин = большая работа, но 60-70% RU ресторанов на iiko — огромный TAM.
- **Acceptance:** ресторан подключил iiko-credentials → за смену 80 блюд автоматически в `finished_product` с временем выпуска.

#### 3.9.2. 1C: Бухгалтерия — выгрузка списаний
- **Goal:** `losses` журнал → раз в неделю CSV/XML экспорт в формате 1С CommerceML на email бухгалтеру.
- **Сложность:** M
- **Hints:** новый cron + Resend email с attachment. Формат — `1С-CommerceML 2.x` (схема публичная).
- **Acceptance:** бухгалтер не делает ручную сверку списаний — приходит ready-to-import файл.

#### 3.9.3. WhatsApp Business API
- **Goal:** для регионов где Telegram под блокировкой — wa.me-link и WhatsApp Business webhooks для notify/digest.
- **Сложность:** M
- **Hints:** Meta WhatsApp Business API — нужен зарегистрированный business profile + одобренный template. ~$0.01-0.05 за message в RU.
- **Acceptance:** менеджер может выбрать WhatsApp как канал, тот же weekly-digest приходит туда.

#### 3.9.4. Yandex.Disk / Google Drive auto-backup
- **Goal:** раз в неделю генерим summary-PDF + JSON dump всех journals → загружаем в подключённый облачный диск ресторана.
- **Сложность:** S
- **Hints:** Yandex.Disk API простой (REST + token). G.Drive — OAuth 2.0. Cron + http.
- **Acceptance:** ресторатор спокоен, что если WeSetup исчезнет — у него все данные в облаке.

#### 3.9.5. Кадастр-чекер по ИНН
- **Goal:** при регистрации компании ввод ИНН → автозаполнение address/director/OKVED через DaData/checko API.
- **Сложность:** S
- **Hints:** DaData бесплатно до 10K запросов/день. checko.ru — альтернатива.
- **Acceptance:** на /register/company ИНН вводится → 2 сек → 5 полей заполнены.

#### 3.9.6. CRM (Bitrix24/AmoCRM) для лидов
- **Goal:** заявки с landing'а → новый лид в Bitrix24, статус-update при подписке.
- **Сложность:** M
- **Hints:** Bitrix REST API + webhooks.
- **Acceptance:** маркетинг видит conversion funnel «лид → trial → paid» в своей CRM.

### 3.10. Compliance enforcement

#### 3.10.1. Hard-gate перед сменой
- **Goal:** в TF сотрудник не может открыть first-task смены, пока не отметил hygiene на сегодня.
- **Сложность:** S
- **Hints:** в TF API `/api/tasks` POST — проверка на наличие `hygiene` entry за сегодня. Server-side gate.
- **Acceptance:** воркер пытается открыть «уборка горячего цеха» — модалка «Сначала пройдите гигиенический контроль».

#### 3.10.2. Soft-block для администратора
- **Goal:** если есть просроченный CapaTicket / breakdown без закрытия — на /dashboard всегда висит non-dismissable модалка.
- **Сложность:** S
- **Hints:** middleware-проверка для management role на dashboard pages.
- **Acceptance:** менеджер не может «забыть» — модалка напоминает каждый день.

#### 3.10.3. Auto-escalation
- **Goal:** TasksFlow задача висит >24ч → push руководителю; >48ч → owner'у. ManagerScope уже даёт иерархию — нужен cron.
- **Сложность:** M
- **Hints:** новый `/api/cron/tasksflow-escalations`. Walking ManagerScope tree.
- **Acceptance:** просроченные задачи реально подхватываются цепочкой управления, не зависают.

#### 3.10.4. «Закрытый день» (read-only after midnight)
- **Goal:** после 23:59 нельзя редактировать journal entries за вчерашний день. Только management через специальное действие с обязательным reason → audit-log.
- **Сложность:** M
- **Hints:** уже есть audit trail (intensive_cooling history). Расширить + middleware-блок в API.
- **Acceptance:** официант не может задним числом «дописать» вчерашний контроль t°. Менеджер может, но запись о факте редактирования сохраняется.

### 3.11. Mobile UX

#### 3.11.1. Offline mode в Mini App
- **Goal:** в Mini App при отсутствии интернета — формы сохраняют в IndexedDB и синкаются когда сеть появится. Нужно для морозильных складов.
- **Сложность:** L
- **Hints:** Service Worker + Background Sync API. Form submit — оборачивать в `idb-keyval` queue. Конфликт-resolution: server wins для journals.
- **Acceptance:** сотрудник в подвальном складе без сигнала заполняет 5 форм → выходит → данные доходят до сервера за 10 сек.

#### 3.11.2. Native iOS/Android app через Capacitor — `[deferred]`
- **Goal:** существующий Mini App обёрнут в Capacitor → publish в App Store / Google Play. Native push, биометрия, BT.
- **Сложность:** XL
- **Hints:** Mini App почти-native, но WebView упирается в Telegram-ограничения. Capacitor — 3-4 месяца на полировку. ROI неясный — Mini App покрывает 95% UX.
- **Acceptance:** ОТЛОЖИТЬ. Не делай это пока не будет 1000+ paid orgs.

#### 3.11.3. Персонализированные пуши
- **Goal:** «Иван, утренняя hygiene 30 сек» вместо «у вас задача». Все Telegram пуши получают переменные {name}, {timeOfDay}, {taskTitle}.
- **Сложность:** S
- **Hints:** правка template-функций в `src/lib/telegram.ts`. Можно вообще через Claude Haiku — генерит персонализированный текст за $0.0001/push.
- **Acceptance:** воркер видит обращение по имени, контекст «утром» / «после смены» — снижается reminder fatigue.

#### 3.11.4. Wearable (Apple Watch / Mi Band) — `[deferred]`
- **Goal:** короткие задачи через смарт-часы. «t° холодильника норма? Yes/No».
- **Сложность:** XL
- **Hints:** требует native app (см. #3.11.2). ОТЛОЖИТЬ.
- **Acceptance:** ОТЛОЖИТЬ.

### 3.12. Customer success / self-serve

#### 3.12.1. Видео-туториалы внутри
- **Goal:** для каждого journal-template — 30-секундное видео «как заполнять». Записать через Loom + хостинг на Yandex.Cloud Object Storage.
- **Сложность:** M
- **Hints:** контент-задача больше чем код. Нужен сервис управления видео-tour'ами. UI — кнопка «?» в углу формы.
- **Acceptance:** для top-10 journals есть видео; новый сотрудник смотрит 30 сек и заполняет правильно.

#### 3.12.2. Чат поддержки в админке
- **Goal:** Intercom-style виджет в углу. Пишет в Telegram-бот поддержки (отдельный чат для команды WeSetup).
- **Сложность:** S
- **Hints:** REST endpoint `/api/support` → grammy → Telegram. На отвечающей стороне — отдельный TG-канал команды.
- **Acceptance:** клиент пишет «не могу импортировать Excel» → команда WeSetup отвечает в течение 4 часов в рабочее время.

#### 3.12.3. Health-check organization (red/yellow widget)
- **Goal:** еженедельный (или real-time) self-audit: пустые roles, journals без active doc, employees без phone, integration не настроена. Виджет на /dashboard «настройка: 7/12».
- **Сложность:** S
- **Hints:** server-side checks в одном API endpoint. Простая логика без AI.
- **Acceptance:** менеджер видит «Здоровье настройки: 8/12» → клик → список «что докрутить».

#### 3.12.4. Тур по Mini App для нового рабочего
- **Goal:** при первом open Mini App — 5-экранный tour: «вот тут ваши задачи», «тут как заполнить», «тут уведомления». shepherd.js или собственный.
- **Сложность:** M
- **Hints:** localStorage flag `mini_tour_seen`. shepherd.js работает в WebView.
- **Acceptance:** новый воркер за 30 сек понимает что нажать, не нужен звонок менеджеру.

### 3.13. Pricing / монетизация

#### 3.13.1. Per-employee pricing
- **Goal:** заменить flat-tier subscription на per-employee. Free до 5 чел, $1/чел/мес после. Аналог Slack-pricing.
- **Сложность:** S
- **Hints:** периодически считать кол-во активных users в org → выставлять счёт через ЮKassa.
- **Acceptance:** маленькая кофейня с 3 сотрудниками — бесплатно. Сеть 50 точек ×10 чел — $500/мес, разумно.

#### 3.13.2. Add-on модули
- **Goal:** базовый тариф $20/mo + IoT-add-on $30/mo + AI-helper-add-on $20/mo + inspector-portal $10/mo.
- **Сложность:** M
- **Hints:** `Organization.activeAddons String[]`. Middleware-чеки в каждом feature.
- **Acceptance:** UI-страница «выбрать модули» с галочками, real-time price calculation.

#### 3.13.3. Партнёрская программа для технологов-консультантов
- **Goal:** технолог получает реферальную ссылку, % с приведённых клиентов на 12 мес.
- **Сложность:** M
- **Hints:** новая `Partner` модель + tracking. UTM в URL.
- **Acceptance:** консультант приводит 5 ресторанов = пассивный доход, рекомендует ваше ПО другим клиентам.

#### 3.13.4. Маркетплейс шаблонов с платными premium-конфигами — `[deferred]`
- **Goal:** см. #3.3.4 + Stripe-style monetization для авторов конфигов.
- **Сложность:** L
- **Hints:** ОТЛОЖИТЬ — это long-tail, не работает без community-объёма.

### 3.14. ROOT / платформа

#### 3.14.1. Audit log платформы (impersonations)
- **Goal:** логировать каждый impersonation ROOT → org с timestamp + IP + reason. Отдельная страница /root/audit-impersonations.
- **Сложность:** S
- **Hints:** уже есть `AuditLog` модель и `recordAuditLog()`. Хук в `/api/root/impersonate`. UI — простая таблица.
- **Acceptance:** ROOT не может «тихо» зайти под org — каждое impersonation видно в audit + клиент-orgа может посмотреть «когда WeSetup-команда заходила в мой аккаунт».

#### 3.14.2. Per-org metrics dashboard
- **Goal:** на /root/organizations — usage (entries/day), retention (last activity), MRR (subscription tier × month), NPS если собираем.
- **Сложность:** M
- **Hints:** агрегаты по `JournalEntry.createdAt` per org.
- **Acceptance:** собственник WeSetup видит метрики бизнеса на одной странице.

#### 3.14.3. Auto-billing через ЮKassa
- **Goal:** `Organization.yookassaShopId` уже есть в schema. Прокачать: автосписание подписки 1 числа, retry 3 дня, suspend на 5-й.
- **Сложность:** M
- **Hints:** ЮKassa API + webhook. Cron `/api/cron/billing` каждое 1 число.
- **Acceptance:** платежи идут автоматически, ручных счетов нет.

#### 3.14.4. Compliance-export для регулятора — `[deferred]`
- **Goal:** машиночитаемый формат (XML по схеме Россельхознадзора, если такая существует) для проверок.
- **Сложность:** L
- **Hints:** ОТЛОЖИТЬ до конкретного запроса от клиента-регулятора. Сейчас Россельхознадзор такое не требует.

---

## 4. Дискавэри в процессе работы (placeholder)

Если по ходу работы найдёшь побочные баги, добавляй сюда новой задачей с пометкой `[discovered]`. Не чини в текущем коммите — только записывай.

_(пусто)_

---

## 5. Глоссарий

- **org** — Organization, тенант. Все business-данные scoped по `organizationId`.
- **ROOT** — `User.isRoot = true`, platform superadmin. Может impersonate любую org.
- **management** — `role in ["manager", "head_chef"]` или legacy `["owner", "technologist"]`. Видит всё в своей org.
- **staff** — `role in ["cook", "waiter"]`. Видит только разрешённые journals (через UserJournalAccess или JobPositionJournalAccess).
- **TF** — TasksFlow, отдельный repo c:\www\TasksFlow.
- **adapter** — `src/lib/tasksflow-adapters/<name>.ts`, мостит между TF-задачей и WeSetup-журналом.
- **document-based journal** — журнал хранится как `JournalDocument` + `JournalDocumentEntry` rows (hygiene, climate, cleaning).
- **field-based journal** — `JournalEntry` с JSON `data` (accident_journal, complaint_register).
- **CCP** — Critical Control Point, термин из ХАССП.
- **СанПиН** — Санитарные правила и нормы РФ. ХАССП = HACCP.
- **СЭС / Роспотребнадзор** — органы, проверяющие пищевые предприятия.
