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

