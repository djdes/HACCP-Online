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

### Приоритет 1 — критичное / в незакрытом MANUAL-статусе после QA-loop

1. **Mini-app onboarding tour (3 экрана)** (F-044) — после первого `signIn("telegram", ...)` показывается тур: «вот журналы», «вот как заполнять», «вот photo evidence». Persist `seenOnboarding=true` в User или localStorage.
2. **Telegram personalize {name}/{timeOfDay}/{dayOfWeek}** (F-056) — функция `personalizeMessage()` есть в `src/lib/telegram.ts:117`. Проверить что используется в weekly-digest, mini-digest, push'ах напоминаний.

### Приоритет 2 — новые идеи для Mini App

3. **Voice-input для notes / комментариев** — в любой `<textarea>` Mini App кнопка микрофона: запись 10–30s → загрузка в `/api/mini/voice` → Whisper-транскрипция (если есть AI ключ) → вставка в textarea.
4. **Offline-first для журналов** — сохранять заполненные карточки в IndexedDB и слать в `/api/mini/.../entries` пачкой когда соединение вернётся. Сейчас Mini App требует онлайн.
5. **QR-сканер для локаций** — на дверце холодильника наклейка с QR (`https://wesetup.ru/qr/cold-3`); сканер в Mini App открывает форму температурного журнала с уже выбранным холодильником №3.
6. **«Я вышел на смену / закончил смену»** — две большие кнопки в `/mini` для `WorkShift.start/end`; геолокация автоматом (если разрешено в Telegram).
7. **Bottom-sheet для photo capture** — нативный pattern: tap «прикрепить фото» → bottom-sheet с опциями «камера / галерея / документ». Сейчас просто `<input type="file">`.
8. **Skeleton-loading состояния** — пока `/api/mini/home` грузится, показывать skeleton-карточки (D2 в WeSetup есть, надо принести в mini).
9. **Pull-to-refresh** — top-of-list жест: дёргает `/api/mini/home`, показывает spinner.
10. **Push «вы не заполнили смену»** — если staff на смене (`WorkShift.startedAt`) но за 4 часа ни одной записи в журнале — пинг от бота: «всё ок?». Cron каждые 30 мин.

### Приоритет 3 — функционал бота (вне Mini App)

11. **Бот-команды для owner-а** — `/today` (что заполнено сегодня), `/missing` (что не заполнено), `/capa` (открытые), `/stats` (% за неделю). Сейчас весь бот пассивный — только push'ы.
12. **Inline-buttons на push'ах** — у каждого push'а «Заполнить сейчас» (deep-link в Mini App), «Отложить на 1 час» (snooze), «Передать другому» (переназначение).
13. **Группа организации** — owner создаёт group-chat с ботом, бот шлёт туда дайджесты, отчёты, escalations. Сейчас всё DM-only.
14. **Voice-note → запись в журнал** — сотрудник без рук (повар) надиктовывает «холодильник 3, минус 18, всё ок» → бот через AI вытаскивает t° и пишет в журнал.
15. **Telegram Stars / Premium-канал** — за пейволлом некоторые AI-фичи (например, AI-помощник в чате). Не первая фича, но отметить.

### Приоритет 4 — техдолг / DX

16. **Тесты для `personalizeMessage()`** — снэпшот-тесты с разным контекстом (имя пустое, timeOfDay граничные часы 0/6/12/18/23).
17. **Структурированный лог TelegramLog** — добавить `latencyMs`, `retryCount`, `errorCode` для диагностики 429/5xx Bot API.
18. **Rate-limit на webhook /api/telegram/webhook** — защита от flood'а Telegram.
19. **Health-check бота** — `/api/telegram/health` который проверяет `getMe()` и валидность `TELEGRAM_BOT_TOKEN`. Дашборд `/root/telegram-logs` показывает зелёный/красный.
20. **`grammy` мидлвары** — если ещё не используется grammy, подумать о миграции с raw-fetch на grammy для удобства.

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
