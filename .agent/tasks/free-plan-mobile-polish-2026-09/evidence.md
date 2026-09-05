# Evidence — free-plan-mobile-polish-2026-09

Дата: 2026-09-05. Локально: `next dev -p 3020`, Playwright (`channel: "chrome"`), скрипты `e2e/local-verify.ts` и `e2e/pause-flow.ts`, результаты `shots/results.json`, `shots/pause-flow.json`, скриншоты `shots/*.png`.

| AC | Статус | Доказательство |
|---|---|---|
| AC1 глобальный flex-wrap удалён, панели кнопок с явным wrap | PASS | globals.css без правила; 52 правки в 37 файлах; sweep 390px по 9 страницам: `scrollW = 390` везде, за viewport выходят только декоративные `absolute` blur-круги внутри `overflow-hidden` hero (`/dashboard`, `/settings`, `/settings/subscription`), интерактивных элементов — 0 |
| AC2 партнёрская модалка на телефоне | PASS | `partnerModalMobile.fits = true`, `childrenOverflowing = 0`, высота 814/844 — `20-partner-modal-mobile.png` |
| AC3 форма заявки | PASS | `partnerForm`: `hasCheckbox`, `sameRow = true`, 7 звёздочек (6 полей + адрес страницы), 2 пометки «не обязательно», легенда — `21-partner-form-mobile.png`, `22-partner-consent-row.png` |
| AC4 trial удалён | PASS | `rg "TRIAL_|trialWrite|trialSensor|consumeTrialWrite|@/lib/trial|aiMonthly|messagesLeft|quotaExceeded|reset-ai-quota"` → 0; дашборд без «Тестовый период» (`dashboardTrialText = false`), подписка без лимитов (`hasTrialWord = false`, `hasFreeNote = true`) |
| AC5 тексты и миграция | PASS | `FREE_PLAN_NOTE` на витринах; `scripts/migrate-trial-to-free.ts` dry-run 86 аккаунтов / 93 организации → `--apply` → 0/0 на локальной БД |
| AC6 пауза за неактивность | PASS | `src/lib/inactivity.test.ts` 7 тестов; cron dry-run 200 (`scanned 92, warned 0, paused 0` — активных кандидатов нет); `pause-flow.json`: баннер на дашборде, карточка на подписке, после «Возобновить работу» план `free`, `pausedFromPlan = null`, `inactivityResumedAt` записан, AuditLog `subscription.resumed` — `30-paused-dashboard-mobile.png`, `31-paused-subscription-mobile.png` |
| AC7 typecheck/tests/lint | PASS | `npm run typecheck` exit 0; `npm test` 563/563; eslint по новым/изменённым файлам 0 ошибок |
| AC8 деплой, миграция, crontab | PASS | Деплой 276b2317 (Actions success, PM2 online, `/login` 200). Миграция: на проде 0 организаций/аккаунтов на `trial` (93 org / 86 acc на `free`) — локальная БД оказалась SSH-туннелем в прод, `--apply` применился ещё при локальной проверке; повторный dry-run на сервере: 0/0. Crontab: `0 7 * * * … /api/cron/auto-pause-inactive`; dry-run на проде `{"ok":true,"organizationsScanned":92,"warned":0,"paused":0}`; `/api/cron/reset-ai-quota` → 404. |

## Не покрыто автоматически
- Письма-предупреждения проверены unit-тестами планировщика и dry-run; реальную отправку на проде видно будет в логах PM2 (`[email/dev]` локально — SMTP не настроен).
- Mini App: строка про trial удалена (typecheck), визуально не проверялось (нужна Telegram-авторизация).

## Важно
- `.env.local` DATABASE_URL (127.0.0.1:5433) — plink-туннель в продовый Postgres. Все «локальные» прогоны (db push, миграция, e2e-пользователь, pause-flow на «Кафе „Тестовое 1“») шли по продовым данным. Тестовый пользователь удалён, план тестовой организации возвращён в `free`; побочно у неё записан `inactivityResumedAt` и AuditLog `subscription.resumed`.
