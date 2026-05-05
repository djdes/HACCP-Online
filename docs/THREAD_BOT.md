# Поток 3 — Telegram Bot / Mini App

> Этот файл — задание для одного из трёх параллельных чатов. Работаешь только с папками бота/Mini App в репе HACCP-Online — не лезешь в дашборд (поток 1) и tasksflow-адаптеры (поток 2).

---

## Что такое Bot / Mini App

WeSetup имеет **Telegram Mini App** (`@wesetupbot`), который заменяет десктопный дашборд для линейных сотрудников: повар на смене заполняет журнал прямо из Telegram, не открывая браузер.

**Что умеет сейчас:**
- Auth через `Telegram.WebApp.initData` → JWT (NextAuth Telegram provider).
- Список «моих журналов на сегодня» (с учётом ManagerScope / UserJournalAccess).
- Field-based журналы — карточки + «как вчера» + photo upload.
- Document-based журналы — сетка employee × day, tap-to-edit.
- Photo-lightbox прямо в Mini App (не открывает в браузере).
- Push-уведомления через бот: напоминания, эскалации, weekly-digest.

**Бот как таковой** (`@wesetupbot`) принимает webhook от Telegram, использует `grammy` framework (или прямой fetch к Bot API), отправляет push'ы через `sendTelegramMessage()`.

**Прод:** https://wesetup.ru/api/telegram/webhook (получает updates от Telegram).
**Репо:** `https://github.com/djdes/HACCP-Online.git` (remote `origin`) — та же что у потока 1, но другие папки.

## Параллельная работа в три потока

Сейчас идут одновременно три чата:
- **Поток 1 — WeSetup core.** Дашборд, журналы (web), отчёты, settings, AI, billing — папки `src/app/(dashboard)`, `src/components/dashboard` и пр.
- **Поток 2 — TasksFlow integration.** Отдельная репа TasksFlow + `src/lib/tasksflow-adapters/*` в HACCP-Online.
- **Поток 3 (этот) — Telegram Bot / Mini App.** Папки `src/app/mini`, `src/app/api/telegram`, `src/app/api/mini`, `src/lib/telegram.ts`.

Конфликтов merge быть не должно — потоки 1 и 3 пушат в одну репу `origin`, но в разные папки. **Между push'ами от потоков 1 и 3 нужно ждать готовности GitHub Actions** (build_sha == HEAD), иначе SCP коллизит.

## Зоны ответственности (только эти файлы можно править)

```
src/app/mini/                          # все страницы Mini App
src/app/api/mini/                      # backend для Mini App (home, entries, bulk-copy)
src/app/api/telegram/                  # webhook бота, отправка push, link-tokens
src/lib/telegram.ts                    # sendTelegramMessage, notifyOrganization, personalize
src/lib/telegram-link.ts               # HMAC link tokens (если есть)
src/app/api/cron/mini-digest/          # daily push для employee
src/app/api/cron/shift-watcher/        # пинг руководству про неактивных на смене
src/components/mini/                   # компоненты mini-app (если есть отдельная папка)
src/app/api/notifications/             # generic notifications layer
docs/THREAD_BOT.md                     # этот файл
```

## Бэклог фич для этого потока

> **Статус 2026-05-06**: после двух loop-сессий поток закрыл основную
> массу из P1-P4, прошло 4 review-pass'а с независимыми code-review
> subagent'ами. Mini App + bot готовы к продакшен-нагрузкам. Ниже —
> только **открытые** задачи.

### Открытые

#### P2 — нереализованные новые идеи для Mini App

1. **Voice-input через Whisper API** — нужен внешний STT-ключ (OpenAI
   Whisper или Yandex SpeechKit). Web Speech API уже работает (см.
   `_components/voice-input.tsx`); нужен fallback для iOS Safari /
   старых WebView через `/api/mini/voice` endpoint. Без ключа — 501.
2. **Offline-first для журналов** — IndexedDB queue для journal entries.
   Сохранять заполненные карточки локально и слать в
   `/api/mini/.../entries` пачкой когда соединение вернётся. Сейчас
   Mini App требует онлайн (`navigator.onLine` детект уже есть в
   `_components/offline-indicator.tsx`).
3. **Voice-note → запись в журнал** — сотрудник надиктовывает «холодильник
   3, минус 18, всё ок» → бот через AI вытаскивает t° и пишет в журнал.
   Завязано на (1).

#### P3 — функционал бота (нереализованный)

4. **Inline-buttons «Передать другому» на push'ах** — snooze уже
   реализован (`notif:snooze:60`), а «передать другому» требует
   двухшагового callback flow (выбор delegatee из dropdown). Сложнее.
5. **Группа организации** — owner создаёт group-chat с ботом; бот
   шлёт туда дайджесты, отчёты, escalations. Сейчас всё DM-only. Big
   задача (group-chat handlers, permission model).
6. **Telegram Stars / Premium-канал** — пейволл для некоторых AI-фич
   (AI-помощник в чате). Бизнес-решение, не приоритет.

#### P4 — техдолг

7. **Структурированный лог TelegramLog в БД** — `latencyMs`,
   `retryCount`, `errorCode` отдельные колонки. Сейчас structured-log
   только в stdout (см. `tag=tg-send` JSON). Требует schema-migration —
   shared с потоком 1.
8. **`/api/mini/voice` endpoint** — выше (1).
9. **Pre-fetch hover/touch для journal cards в /mini home** — мгновенная
   навигация. Минорный win, не критично.

### Закрытое (история)

> 25 коммитов за две loop-сессии, ~50 fixes из 4 review-pass'ов:

#### Реализовано
- ✅ **F-044** Mini-app onboarding tour (3 экрана) + anti-anon gate.
- ✅ **F-056** `personalizeMessage` с `{greeting}` (правильный род),
  HTML-escape `{name}`, snapshot-тесты, distribute в digest builders +
  `notifyOrganization`.
- ✅ **QR-сканер** с поддержкой `wesetup.ru/qr/<slug>` коротких ссылок
  (`cold-3`, `eq-<uuid>`, `journal-<code>`) + 8 unit-тестов.
- ✅ **«Я вышел / закончил смену»** в `/mini` (`MyShiftButton`) +
  `/api/mini/shift/me` API.
- ✅ **Photo bottom-sheet** «камера / галерея».
- ✅ **Photo client-side compression** (1600px @0.85, 3MB→500KB на
  cellular) + 10 unit-тестов.
- ✅ **Skeleton-loading** на `/mini` home и `/mini/journals/[code]`.
- ✅ **Pull-to-refresh** свайпом вниз с retry-on-500.
- ✅ **Shift-watcher Stage 3** — friendly DM сотруднику после 4ч
  бездействия с кнопкой «🔕 Отложить 1ч» (snooze).
- ✅ **Bot-команды для рук-ва**: `/today`, `/missing`, `/capa`, `/stats`,
  `/staff`, `/batches`, `/losses`, **`/who-late`**, **`/health`**.
- ✅ **Bot-команды для сотрудника**: `/shift` (inline start/end),
  `/me`, **`/my-digest`**.
- ✅ **Inline-buttons «Заполнить» / «Отложить»** на push'ах —
  `notif:snooze:60` + `web_app` deep-link в Mini App.
- ✅ **Snapshot-тесты для `personalizeMessage`** — 14 тестов на
  граничные часы 0/6/12/18/23, имена, дни недели.
- ✅ **Structured-log TelegramLog** в stdout (JSON `tag=tg-send`,
  latencyMs, attempts, errorCode).
- ✅ **Rate-limit на webhook** + на все bot-callbacks
  (`botCallbackRateLimiter` 30/min на pair (chatId, prefix)).
- ✅ **Health-check бота** — `/api/telegram/health` с `getMe()` race
  + 5s timeout. Утечку `BOT_TOKEN` через err.message закрыли redaction.
- ✅ Bot всё на grammy (composer, callbackQuery, command).

#### Critical security/HACCP fixes (Pass-1/2/3/4)
- HTML-injection в `/api/mini/notify` (escape + zod schema 2000 chars
  + URL hostname whitelist).
- Disk-fill DoS на `/api/mini/attachments` (60/day rate-limit).
- HACCP compliance falsification: `bulk-copy-yesterday` теперь
  блокируется для document-журналов (раньше создавал phantom-rows).
- Bulk-copy race-condition: `db.$transaction({Serializable})` +
  sequential `for` внутри tx.
- Дублирующий callback `shift:start` (shift-gate VS staff-tools) —
  переименован в `shift-tg:start/end`.
- VoiceInput stale-closure снежный ком.
- Claim/complete mutex на `/mini/today`.
- syntheticEmail UUID + P2002 retry.
- Audit details redaction (REDACT_KEYS recursive) + 9 unit-тестов.

#### UX
- Telegram BackButton wiring на всех вложенных `/mini/*`.
- signIn 12s timeout с явным error-state + retry-button.
- Empty-state «нет назначенных задач» для нового сотрудника (vs
  ложного «всё выполнено»).
- ConfirmDialog для destructive (sign-out, unlink с typeToConfirm).
- Safe-area-inset для iPhone notch / home-indicator.
- Phone normalize (+7/7/8/10-digit).

#### Performance
- `/api/mini/today` 64 sequential queries → 33 (batch claims, parallel pool/ACL).
- `/stats` 7 sequential `groupBy` → 1 query.
- Photo compression на клиенте.
- ObjectURL вместо data-URL в image-compress (37% memory).

#### Theme/visual
- Dark/light migration на ВСЕ `/mini/*` (page, journals, shift-handover,
  iot, equipment, audit, staff, me).
- Skeleton-каркасы.
- Emoji ▶️/⚡ → lucide Play/Zap.
- Tap-target ≥44×44 в onboarding-tour.

#### Infra
- **Persistent prod 500's** на nested `/mini/*` побеждены: `prewarm-routes.sh`
  покрывает все 10 routes + `hit_with_retry` (3 попытки) обрабатывает
  Next.js 16 client-reference-manifest JIT race.
- Webhook rate-limit (60 req/min на IP).

## Правила деплоя

1. После каждой самостоятельной фичи: `git add <files>; git commit -m "<рус>"; git push origin master`.
2. Деплой автоматический через GitHub Actions. **Внимание:** поток 1 пушит в ту же репу. Перед своим push'ем убедись что предыдущий deploy дошёл (`.build-sha == HEAD на проде`), иначе SCP collision.
3. Для проверки бота локально: используй `ngrok` для вебхука или `polling` mode (`bot.start({ updates: ['message'] })`).
4. Type-check перед commit'ом: `npx tsc --noEmit --skipLibCheck`.
5. Тестировать Mini App нужно внутри Telegram (можно через `@BotFather` test environment), либо открывать `/mini?test=1` напрямую в браузере с инициализацией mock-`initData`.

## Не делай

- Не правь `src/app/(dashboard)/*`, `src/app/(auth)/*`, `src/app/api/journals/*` (web-журналы), `src/components/dashboard/*` — это поток 1.
- Не правь `src/lib/tasksflow-adapters/*` или `src/app/api/integrations/tasksflow/*` — это поток 2.
- Не меняй `prisma/schema.prisma` без согласования с потоком 1 (миграции shared).
- Не меняй `src/lib/auth-helpers.ts`, `src/lib/auth.ts`, `src/lib/journal-acl.ts` — они shared, эти изменения проходят через поток 1.
- Не пушь без type-check.
- Не force-push в master.
