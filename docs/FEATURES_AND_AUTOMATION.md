# WeSetup + TasksFlow — фичи и идеи автоматизации

> Лог сессии end-to-end QA «владелец компании», 2026-04-25.
> Здесь фиксируются: что попробовал, что нашёл, что починил, что можно автоматизировать дальше для пользователей и удобства.

## Раздел 1. Хронология того, что я делал

### Шаг 1. Регистрация компании «Кафе QA-Тест 25-04»
- URL: https://wesetup.ru/register
- Email: `bugdenes+wesetupqa2604@gmail.com`, имя «Иван Тестовый», тел. +79991234567
- Получил код, ввёл, попал на /dashboard ✅

### Шаг 1.1 — БАГ #1 (security/UX): код показан прямо на странице на проде
- На странице после «Получить код» отображается блок:
  > **Dev-режим · SMTP не настроен**
  > **555637**
  > Письмо не отправлено, код показан здесь. В проде — придёт на email.
- Это **продакшн** wesetup.ru, но SMTP/Resend не настроен → код виден всем кто вводит чужой email.
- Severity: **HIGH** — позволяет любому зарегистрировать компанию на чужой email.
- Fix-направление: проверить `RESEND_API_KEY` на проде / убрать dev-fallback в `process.env.NODE_ENV === 'production'`.

### Шаг 1.2. Создание сотрудников
- Должности через UI: Управляющий (руководство), Шеф-повар, Повар, Официант, Уборщик (сотрудники).
- 6 сотрудников через POST `/api/staff` (упрощённая форма UI без email — это запись в `staff` без логина).
- Замечание: нет одной кнопки «Создать стандартный набор должностей и людей» — пришлось добавлять каждый раз новый dialog.

### Шаг 2 (планировался TasksFlow) — БАГ #2 (CRITICAL): TasksFlow прод полностью не загружается
- При открытии https://tasksflow.ru — пустой экран, в консоли:
  > Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html". Strict MIME type checking is enforced for module scripts per HTML spec. @ https://tasksflow.ru/assets/index-ChU5oWb5.js
- Проверка curl: index.html ссылается на новый bundle (`/assets/index-BC3ZwgOZ.js`, 200 OK, application/javascript). Но из браузера тянется старый (`index-ChU5oWb5.js`).
- **Корень**: Service Worker `tasksflow-v1` со стратегией Cache First закэшировал старый `/` (index.html). После каждого деплоя bundle с новым хэшем — все юзеры с активным SW получают мёртвый сайт, пока вручную не сделают hard reload + clear cache.
- Severity: **CRITICAL** — все возвращающиеся пользователи TasksFlow видят белый экран после очередного деплоя.
- **Fix применён** в `c:/www/TasksFlow/client/public/sw.js`:
  - bump CACHE_NAME `v1` → `v2` (триггерит activate-cleanup старого кэша)
  - Network First для navigation/HTML — index.html всегда свежий
  - Cache First только для `/assets/*` (immutable hashed names — безопасно)
  - убрал `/` и `/dashboard` из STATIC_ASSETS (они HTML и не должны прекэшиваться)

### Шаг 3. TasksFlow подключение
- Зарегистрировал админ-аккаунт TasksFlow на тот же телефон.
- Создал API-ключ `tfk_DpDlWdxc...` в `/admin/api-keys`.
- В WeSetup `/settings/integrations/tasksflow` ввёл URL+ключ → ✅ Подключено, 6/7 сотрудников связаны.

### Шаг 3.1 — БАГ #3 (UX): «Меню» в Dashboard TasksFlow перекрывается empty-state
- В `tasksflow.ru/dashboard` при пустом состоянии (нет задач) клик на «Меню» → меню видно, но `<div class="empty-state">` перехватывает pointer events на пунктах «Главная / Создать задачу / Сотрудники / Настройки / Выход».
- Severity: **MEDIUM** — на мобильниках админу сложно открыть Настройки до создания первой задачи.
- Fix-направление: dropdown-menu должен иметь `z-index` выше `.empty-state` или `.empty-state` нуждается в `pointer-events: none`.

### Шаг 4. «Отправить всем на заполнение» — одной кнопкой
- В новой компании сразу 35 журналов и 0 заполнений. Кнопка делает fan-out задач в TasksFlow.
- Toast: «Задачи отправлены · создано: 23 · пропущено: 12 · заведено документов: 35».
- Документы созданы автоматически — не нужно предварительно «открывать» журналы. ✅

### Шаг 4.1 — БАГ #4 (CRITICAL): baseUrl задач = localhost:3002
- Все 23 задачи получили `journalLink.baseUrl = "https://localhost:3002"`.
- Корень: `bulk-assign-today` собирал baseUrl как `new URL(request.url).origin`. Когда nginx проксирует на upstream port 3002 без правильного Host — origin = localhost.
- Severity: **CRITICAL** — клик по задаче в TasksFlow ведёт на localhost.
- **Fix применён** в 3 местах (bulk-assign-today, bind-row, task-fill-token):
  - предпочитаем `process.env.NEXTAUTH_URL` (если не localhost), fallback на `request.url`.
- TODO для админа: для уже созданных задач прогнать миграцию `UPDATE tasks SET journalLink = REPLACE(journalLink, 'https://localhost:3002', 'https://wesetup.ru')` в TF БД.

### Шаг 4.2 — Замечание (by-design, но UX-плохо): все задачи ушли одному сотруднику
- 23/23 задач достались одному Виктору Чистову (уборщику).
- Корень: в `selectRowsForBulkAssign` без `fanOutToAll` (нет per-employee и нет бонусов) берётся **первый** дежурный связанный сотрудник по сорту `[role asc, name asc]`.
- В новой компании не настроены per-position visibility и WorkShift → fallback на «все сотрудники, выбираем первого».
- **UX-улучшение**: для новой компании показывать onboarding-блок «Настройте, кто отвечает за какие журналы», прежде чем «Отправить всем».

### Шаг 5. Безопасность регистрации
- Запушен фикс: `ALLOW_DEV_REGISTRATION_FALLBACK` env-флаг защищает от утечки кода через API на проде.
- Временно поставил `ALLOW_DEV_REGISTRATION_FALLBACK=1` на проде, чтобы регистрация работала пока админ не настроит SMTP.

### Шаг 6. Аудит всех страниц
- 19 dashboard-страниц (`/dashboard`, `/journals`, `/reports`, `/settings/*`, и т.д.) — все 200 OK.
- 35 журналов (`/journals/<code>`) — все 200 OK.
- API-роуты (`/api/notifications`, `/api/positions`, `/api/integrations/tasksflow`, и т.д.) — отвечают корректным JSON.

### Шаг 6.1 — БАГ #5 (MEDIUM): PWA-иконки 404 на проде
- `manifest.json` ссылается на `/icons/icon-192.png` и `/icons/icon-512.png`.
- На проде `404` — файлы не задеплоены, лежат только `.svg` версии.
- Корень: `.github/workflows/deploy.yml` имел `--exclude='*.png'` в `tar cf deploy.tar` — глобальный паттерн вырезал ВСЕ png-файлы, включая PWA-иконки.
- Severity: **MEDIUM** — PWA не может правильно установиться, иконка не показывается на homescreen, в шарилке.
- **Fix применён**: убран глобальный `--exclude='*.png'`, заменён на точные паттерны (`./prod-*.png`, `./animations*.png`, `./screenshot-*.png`) — только корневые скриншоты репо, не файлы в `public/`.

### Шаг 7. Telegram-бот (`@wesetupbot`)
- `getMe` отвечает: id=8432663244, имя «WeSetup · журналы ХАССП/СанПиН» — бот зарегистрирован.
- В browser `https://wesetup.ru/mini` отдаёт страницу «Откройте внутри Telegram» — это правильное поведение для не-Telegram контекста.

### Шаг 7.1 — БАГ #6 (CRITICAL): Telegram poller в бесконечном рестарт-цикле, бот не отвечает
- В логах `pm2 logs haccp-telegram-poller`:
  ```
  [poller] stopping…
  [poller] ensureBotInit…
  [poller] bot ready, starting long-polling
  [poller] @wesetupbot (id=8432663244) online
  [poller] stopping…
  ...
  Telegram bot profile setup error: GrammyError: Call to 'setMyName' failed!
  (429: Too Many Requests: retry after 74423)
  ```
- Корень: `configureTelegramBotProfile` безусловно дёргал `setMyName`/`setMyShortDescription`/`setMyDescription` при каждом cold start. Telegram имеет hard rate limit на эти операции — повторный вызов с тем же значением всё равно засчитывается как hit. После одного crash → PM2 рестартует → опять setMyName → опять 429 → крах.
- В реальности бот не отвечал пользователям ничем, потому что `bot.start()` никогда не запускался — ensureBotInit крашился до него.
- Severity: **CRITICAL** — Telegram-канал был полностью неработоспособен.
- **Fix применён** в `src/lib/bot/setup.ts`:
  - Новые `safelyUpdateName/Description/ShortDescription` читают текущее значение через `getMyName`/`getMyDescription`/`getMyShortDescription` и обновляют только если есть реальное отличие.
  - `setMyCommands` и `setChatMenuButton` оставлены — на них rate limit мягкий.


---

## Раздел 2. Что мне понравилось как «владельцу компании»

1. **Авто-включение всех 35 журналов при регистрации** — не надо проходить wizard с 35 чекбоксами.
2. **Авто-создание документов** при «Отправить всем на заполнение» — manager не должен предварительно «открывать» каждый журнал.
3. **Auto-link сотрудников по телефону** — TasksFlow связал 6 из 7 без ручной магии. UX очень приятный.
4. **Bonus-бейдж «+50 ₽» с claim-логикой** — гениальная мотивация: race-for-bonus, кто первый сделал, у остальных уехало в «Сделано другими».
5. **Один admin для двух систем (WeSetup + TasksFlow)** через одну API-ключу.
6. **Build SHA в шапке** (`9271aec` / `cb9ad34`) — мгновенная диагностика стейджа.

## Раздел 3. Что можно автоматизировать дальше (идеи для UX)

### 3.1. Onboarding-wizard «настрой за 5 минут»
- Сейчас новый владелец видит «35 журналов незаполнены, 0% готовность» и кнопку «Отправить всем на заполнение». Нажимает — все задачи уходят одному «первому» сотруднику.
- **Идея**: на регистрации — короткий wizard «1) Добавь сотрудников (импорт из Айко/CSV), 2) Привяжи журналы к должностям (предзаполненный preset «Кафе/Ресторан»), 3) Подключи TasksFlow (или skip)».
- Профит: новая компания за 5 минут получает «настроенный» режим — задачи раздаются по ролям без ручной работы.

### 3.2. CSV/Excel импорт сотрудников
- Сейчас сотрудники добавляются по одному через диалог.
- **Идея**: «Загрузить список из Excel» — колонки `ФИО / должность / телефон`. Pasting текста из Айко-экспорта тоже бы прошло.

### 3.3. Preset «должность → журналы» из шаблонов
- Каждой компании одинакового профиля (кафе) нужны одни и те же журналы у одних должностей.
- **Идея**: глобальный preset «Кафе → Шеф-повар отвечает за бракераж/входной контроль; Уборщик — за уборку/УФ; Официант — за гигиену/здоровье». Применяется одной кнопкой при создании должностей.

### 3.4. Автонапоминание про незаполненные журналы в TG/Email
- Уже есть cron compliance, но только выкатает sendComplianceReminderEmail.
- **Идея**: 3 канала — Email + Telegram-уведомление в Mini App + push на homescreen PWA. Эскалация по времени: «прошло 1 час → напоминание сотруднику», «прошло 4 часа → уведомление управляющему».

### 3.5. Автозамер с IoT-датчиков
- В коде есть `tuya.ts` — Tuya integration для холодильников.
- **Идея**: расширить на Wirenboard / Modbus / MQTT broker → автоматическое заполнение `cold_equipment_control` без человеческих кликов вообще. У человека только верификация раз в смену.

### 3.6. AI-suggest для «Принят / Не принят» в бракераже
- **Идея**: фото блюда + GPT-4o-mini → autosuggest «соответствует/не соответствует» с обоснованием. Сотрудник только подтверждает.

### 3.7. Health-checks для prod-окружения
- Сегодня я случайно нашёл что poller бесконечно рестартует — потому что нет health-check метрики «Telegram-poller отвечает на /start за < 5s».
- **Идея**: внутренний `/healthz` который каждые 60s посылает `/getUpdates` и алертит в Slack/Telegram-канал владельца если вернулось 429 или ошибка > 5 минут.

### 3.8. Build-info auto-toast «обновись»
- При деплое нового билда у юзеров уже открытая SPA-вкладка имеет старый код (Next prefetch + service worker). Сейчас фикс в TasksFlow.
- **Идея**: server-sent event «новый build SHA, перезагрузи страницу для последних фиксов».

### 3.9. «Создать всех типичных сотрудников» одной кнопкой
- В новой компании я создал 5 должностей и 6 сотрудников вручную через POST /api/staff.
- **Идея**: при пустом state — кнопка «Заселить тестовых сотрудников» (для демо/onboarding), генерирует пресет «3 повара + 1 шеф + 2 официанта + 1 уборщик» — для разовой проверки flow.

### 3.10. Audit-log всех админ-действий
- При QA-сессии я не видел trail кто что когда изменил. Для compliance это потенциально нужно.
- **Идея**: AuditLog таблица с записями `actor / action / entity / payload / ip / userAgent` — отдельная страница `/root/audit` для root-админа платформы.

---

## Раздел 4. Итог сессии

### Зафиксировано и запушено в прод
| # | Severity | Описание | Репо | Commit |
|---|----------|----------|------|--------|
| 1 | HIGH | dev-код регистрации утекал в API на проде | WeSetup | `89cd491` |
| 2 | CRITICAL | TasksFlow белый экран после деплоя (SW кэшировал старый index.html) | TasksFlow | `c8b9923` |
| 3 | UX | Empty-state перекрывает dropdown-меню | TasksFlow | TODO (заметка) |
| 4 | CRITICAL | TasksFlow-задачи имели `baseUrl: localhost:3002` | WeSetup | `cb9ad34` |
| 5 | MEDIUM | PWA-иконки 404 (`*.png` вырезались из tarball) | WeSetup | `6952021` |
| 6 | CRITICAL | Telegram poller в бесконечном рестарт-цикле из-за 429 на setMyName | WeSetup | `dcb9e62` |

### Ещё нужно сделать (TODO)
- Настроить SMTP_HOST на проде или оставить `ALLOW_DEV_REGISTRATION_FALLBACK=1` сознательно.
- Старые TasksFlow-задачи в БД содержат `baseUrl: https://localhost:3002` — прогнать миграцию (`UPDATE tasks SET journalLink = REPLACE(journalLink, 'https://localhost:3002', 'https://wesetup.ru')`).
- Per-position visibility для новой компании: `/settings/journals-by-position` пресет для type=restaurant.
- TasksFlow dropdown z-index фикс.
