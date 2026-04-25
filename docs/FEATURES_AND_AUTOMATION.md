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

