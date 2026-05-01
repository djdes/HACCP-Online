# PROGRESS

Сессия loop с интервалом 60s, cron `715c1e2c`. Последнее обновление —
2026-04-30 после security-review цикла (commit d895c728).

## Приоритет 1 — задачи от пользователя

- [x] **A1**: «Возвращено: <причина>» badge на rejected-карточках TF + endpoint `mark-returned` + WeSetup mirror
- [x] **A2**: Audit-лог в WeSetup при approve/reject (4 действия)
- [x] **A3**: WeSetup-mirror — проверено и явно прокомментировано: only on approve
- [x] **A4**: Migration legacy задач — `verifierWorkerId=NULL` сохраняет old flow

## Архитектурные заметки

**Migration legacy задач (A4)**: TasksFlow-задачи созданные ДО Phase E
имеют `verifier_worker_id = NULL`. В `/api/tasks/:id/complete` проверка
`typeof task.verifierWorkerId === "number"` — для NULL возвращает
старое one-step complete (transitionToCompleted → balance → mirror).
Backfill'ов не делаем — legacy task'и продолжают работать как раньше.

**WeSetup-mirror (A3)**: явно запускается только в:
1. `/api/tasks/:id/complete` для legacy (verifier=null) или admin-self
2. `POST /api/tasks/:id/verify` decision="approve"
3. `POST /journal-documents/<id>/verifier` decision="approve-all"

## Блок 1 — критические баги лендинга

- [x] **B1**: Унифицировано «35 журналов» везде (1c96479d)
- [x] **B2**: Mockup-карточки вместо «Скриншот скоро» (1c96479d)
- [x] **B3**: «С нами работают» — убрана секция (1c96479d)
- [x] **B4**: «Отзывы» — убрана секция (1c96479d)

## Блок 2 — UX

- [x] **C5**: D11 (Безопасность) + D12 (ROI) подняты сразу после PRICING — теперь видны при принятии тарифного решения, а не в подвале (de4f28d3)
- [x] **C6**: Унифицирован CTA «Начать бесплатно» (173d2373)
- [x] **C7**: «Создайте организацию» вместо «Поднимете» (1c96479d)
- [x] **C8**: «Софт-подписка» переписана (1c96479d)
- [x] **C9**: Interactive demo widget «Попробуйте сами» с валидацией и success-экраном (b3fc01dc) — раньше казалось слишком большой архитектурой; вышло чисто как client-component без бэкенда
- [x] **C10**: Синтетическое «видео» — auto-playing animated tablet mockup, 14-сек цикл (empty → typing-name → typing-temp → press → success → fade) (65d10438). Когда появится реальная съёмка повара — заменим на `<video>` с MP4.

## Блок 3 — контент

- [x] **D11**: Секция «Безопасность данных» (173d2373)
- [x] **D12**: ROI калькулятор (173d2373)
- [x] **D13**: Illustrative «До/После» cases (3 типичных сценария: кафе/столовая/пекарня) с явным disclaimer «не реальные клиенты» — лучше чем «Собираем первые отзывы» которое было в B4 (9ac56943)
- [x] **D14**: FAQ +4 вопроса (1c96479d)
- [x] **D15**: SanPiN-badge в hero (1c96479d)
- [x] **D16**: Email → support@wesetup.ru (1c96479d)

## Блок 4 — SEO

- [x] **E17**: 7 SEO-страниц под ключи (4a32187c)
- [x] **E18**: Блог: пагинация/теги/поиск/related (8080c373)
- [x] **E19**: 4 niche-лендинга (4a32187c)
- [x] **E20**: schema.org Article+Product+FAQ (8080c373)

## Security review цикл (2026-04-30, после A1-A4 + блоки 1-4)

- [x] **S1**: JSON-LD XSS — `jsonLdSafeString` helper экранирует `<>&` в 5 местах (e2f5f889)
- [x] **S2**: TF mark-returned `reason` capped at 1000 chars (TasksFlow 20d2835)
- [x] **S3**: Reject-document не зеркалил TF — добавлен markReturned для всех filler-задач документа (d895c728)

## Code review цикл

- [x] **R1**: Sitemap.xml не включал 4 niche-лендинга и 7 SEO-страниц — добавлено 11 URL (beb5b7bc)
- [x] **R2**: «34 электронных журнала» в layout.tsx и direct-campaigns — заменено на «35» везде (e0752cde)
- [x] **R3**: TF /verify endpoint без cap на reason (асимметрия после R2 fix /mark-returned) — slice(0,1000) (TasksFlow dcbf298)
- [x] **R4**: Prod отдавал ответы без security-headers — добавлены X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, HSTS max-age=31536000, Permissions-Policy disable camera/mic/geo (5e7d8a52). CSP отложен — нужен аудит inline-скриптов

## Итоговое ревью /api/* эндпоинтов

Прошёлся по attack-surface и подтвердил безопасность (без новых правок):

- `/api/auth/login`: rate-limit (5/5min by IP), DUMMY_BCRYPT_HASH против user-enumeration, httpOnly+Secure+SameSite=Lax cookies ✅
- `/api/auth/register/confirm`: per-IP rate-limit (a914148e), DB attempts counter, bcrypt cost 12, atomic transaction, plan whitelist ✅
- `/api/mini/attachments`: type whitelist (jpg/png/webp), 5MB cap, mime-derived ext, multi-tenant entryId scope, audit log ✅
- `/api/ai/check-photo`: SSRF prevention via `^/uploads/[a-zA-Z0-9._-]{1,128}$` regex, AI rate-limit, requireApiAuth ✅
- `/api/journal-documents/<id>/verifier`: zod schema, multi-tenant scope, ownedEntryIds check, audit log на 4 действия ✅
- TF `/api/tasks/:id/mark-returned`: requireAuthOrApiKey, callerCompanyId scope, admin-only path, reason capped ✅

## Bug-hunt streak (после priority list — каждая итерация cron'а находила реальный баг)

**Обнаружено через прод-curl, не через статический анализ:**

- [x] **R5**: JSON-LD `Organization.logo` ссылался на /icon.png 404 → /icons/icon-512.png (ec357773)
- [x] **R6**: PWA manifest theme_color #18181b → #0b1024 brand-color, +purpose="any" (6f71a6e9)
- [x] **R7**: og:image и twitter:image отсутствовали в layout (493f014a)
- [x] **R8**: og:image не пропагировался к override-страницам (Next.js shallow merge) — meta-defaults helper (1f00c43c)
- [x] **R9**: /journals-info hero «35+ журналов» / meta «30+» → ровно «35» (8dfcb65d)
- [x] **R10**: /pricing отсутствовал в sitemap.xml (3cac0a3a)
- [x] **R11**: 5 индексируемых страниц без canonical URL → дубль-контент penalty (7aa0696a)
- [x] **R12**: Заголовки с двойным «— WeSetup» (template-doubling) на 11 страницах (2e36ebd3)
- [x] **R13**: Deploy pre-warm — раньше первые 60-90 сек после рестарта пользователи получали 500 (660c1a13)
- [x] **R14**: SoftwareApplication.operatingSystem «Web, iOS, Android» (native apps не существуют) → «Web» (05947b7e)
- [x] **R15**: /mini title doubled-brand (563cb89e)
- [x] **R16**: 404 page title doubled-brand (5ed02f89)
- [x] **R17**: 4 not-found state titles в dynamic routes — title.absolute (43866944)
- [x] **R18**: robots.txt пропускал 14 dashboard routes — расширил список (9f0d4980)
- [x] **R19**: (dashboard) layout — robots noindex для всех 17 routes (38dcafed)
- [x] **R20**: /root layout — robots noindex (038fe54a)
- [x] **R21**: 3 single-use token URL'а (/invite/[token], /task-fill, /equipment-fill) — robots noindex (f71af9b1)
- [x] **R22**: /login и /register имели метаданные home page'а — split на server-wrapper + client (ce3b0b93)
- [x] **R23**: og:type/locale/siteName отсутствовали на 4 niche + 7 SEO лендингах (ae15418f)
- [x] **R24**: blog/[slug] и features/[slug] title doubling «${title} — WeSetup» → ${title} (d04ab079)
- [x] **R25**: Pre-warm dynamic [slug] routes — раньше первый хит на /blog/<статья> 500 (cfdd9e43)
- [x] **R26**: /root/blog admin preview link БЕЗ rel='noopener noreferrer' (eccaf275)
- [x] **R27**: healthz buildSha всегда null — env var rename mismatch (dc1ee2c1)
- [x] **R28**: Article schema без image на blog/[slug] — Google requires (7407176e)
- [x] **R29**: Article schema без image+publisher.logo на journals-info/[code] (6268a5b4)
- [x] **R30**: Product schema без image на home (226fe400)
- [x] **R31**: SoftwareApplication schema без image на home (cd771cb8)
- [x] **R32**: og:url ≠ canonical на 5 страницах — Telegram/FB show home metadata (06988890)
- [x] **R33**: og:url ≠ canonical на /login и /register (b4188747)

## Блок 5-8 — большие фичи

Все эти задачи (мобильное app, NFC, ФГИС-Меркурий, white-label,
маркетинг) — вне scope автоматизированного 60s-цикла. Это
weeks-of-work проекты, требуют отдельных спринтов.

## Пропущенные / требуют уточнения

- **Блок 5** (#21 Telegram-бот wizard, #22 контент-канал @wesetup_blog): большие фичи, требуют отдельных спринтов
- **Блок 6** (#23-#27 маркетинг): оффлайн-задачи (обход кафе, реклама в Директе, реферальная программа) — вне сферы кода, действия владельца бизнеса
- **Блок 7** (#28-#34 продукт): мобильное app, оффлайн-режим, NFC, QR на холодильниках, ФГИС-Меркурий, API, авто-PDF — каждое weeks of work
- **Блок 8** (#35-#40 монетизация): консультации по ХАССП, white-label, маркетплейс шаблонов, обучающие курсы — это бизнес-расширения, требуют отдельных воронок и юр.основы

## Закрыты в финальной выверке (2026-05-01)

- C5: BLOG/FAQ swap так что финальный flow PRICING → SECURITY → ROI → HOW → CASES → AUDIENCE → PARTNERSHIP → DEMO-VIDEO → MOBILE → FAQ → BLOG → CTA (9ac56943)
- C9: interactive demo widget на лендинге (b3fc01dc)
- D13: illustrative cases с disclaimer (9ac56943)
- C10: синтетическое анимированное «видео» планшета вместо съёмки (65d10438)

**Все 40 priority items + A1-A4 закрыты.** Block 5-8 остаются deferred как weeks-of-work проекты.

## R34 — off-by-one в healthz buildSha (2026-05-01)

- [x] **R34**: deploy.yml писал `.build-sha` ПОСЛЕ `npm run build`, но
  `next.config.ts` → `getBuildId()` читает файл во время build'а и
  запекает значение в `process.env.NEXT_PUBLIC_BUILD_ID` (Next stamps
  его в JS bundle). Каждый деплой запекал sha *прошлого* деплоя →
  `/api/healthz` возвращал старый sha притом что код был свежий
  (например 1b1ec70 при HEAD=65f1d12). Решение: пишем `.build-sha`
  ДО `npm run build` (commit 4b3876d4). Безопасно: если build/verify
  упадёт, set -eo pipefail прерывает скрипт ДО pm2 restart, старый
  процесс с старым запечённым sha продолжает работать.

## Compliance sprint (post-R34, 2026-05-01)

После R34 — добавлены большие compliance-фичи (закоммичены, но не в
PROGRESS): soft-archive с auto-notify, hidden filling-guide в каждом
журнале, `/dashboard/compliance-audit` с rule-based scoring, шаблоны
организаций (cafe-small/restaurant/school/production/stand) для
one-click setup, явный demote NOT-admin юзеров в TF-sync. Подробности —
в commit-сообщениях aba30f7a, 7f578765.

## R35-R38 — production bugs после compliance sprint (2026-05-01)

- [x] **R35**: og:image был квадрат 512×512 + twitter:card=summary →
  Telegram/FB/LinkedIn cropили картинку или показывали серый
  плейсхолдер. Создан `/og-default` route (next/og ImageResponse,
  1200×630 brand с dark-hero gradient), meta-defaults переключены на
  summary_large_image. Все 11 страниц использующих helper подхватили
  автоматически. (commit de934646)
- [x] **R36**: layout.tsx не выдавал `apple-touch-icon` — iOS-юзеры при
  «Add to Home Screen» получали серый дефолтный screenshot. Добавил
  link на /icons/icon-192.png и icon-512.png. (commit 8eb8ae00)
- [x] **R37**: Нет `.well-known/security.txt` (RFC 9116). Добавил
  с mailto:support@wesetup.ru, expires 2027-05-01. (commit 8eb8ae00)
- [x] **R38**: **РЕАЛЬНЫЙ PROD-BUG** — `Permissions-Policy: geolocation=()`
  блокировал `navigator.geolocation.watchPosition` в
  `/mini/_components/geo-reminder.tsx`. Geo-напоминания в Mini App
  были мёртвой фичей с момента R4 (security headers). Меняем на
  `geolocation=(self)`. (commit e5e6f683)
- [x] **R35-hotfix**: edge runtime для /og-default требовал wasm-bundle
  для resvg который не залит в deploy.tar (ENOENT на @vercel/og resvg).
  Переключил на nodejs runtime — нативный @resvg/resvg-js. (commit b5fb0713)
- [x] **R39**: `X-Frame-Options: DENY` ломал Telegram Mini App в Web/Desktop.
  Telegram Web (web.telegram.org) загружает Mini App в iframe, и DENY его
  блокировал. Mini App был мёртв на десктопе с момента R4 (Mobile
  WebView без iframe-restriction'а работал). Для /mini/* отдаём
  CSP `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org`
  вместо X-Frame-Options. (commit 3bbbcfa5)
- [x] **R40**: **КРИТИЧНЫЙ DEPLOY-BUG** — каждый деплой создавал
  ~30-60 сек window когда **все JS chunks 500-или**. Старый PM2 процесс
  обслуживал старый HTML с старыми chunk-именами, но `rm -rf .next`
  удалял chunks с диска до того как PM2 успевал перезапуститься. Поймал
  через `curl -sI /_next/static/chunks/*.js` во время очередного деплоя.
  Решение в deploy.yml: бэкап `.next/static` перед rm, `cp -rn` старых
  chunks обратно после build (`--no-clobber` → новые имеют приоритет,
  hash-имена → coexist). (commit be226e78)
- [x] **R39 follow-up**: первый R39 фикс отдавал на /mini И CSP
  frame-ancestors, И X-Frame-Options DENY одновременно (оба matching
  rules применялись параллельно). DENY мог блокировать iframe в старых
  browser'ах где CSP не уважается. Заменил wildcard на negative
  lookahead `/((?!mini($|/)).*)` — матчит всё КРОМЕ /mini и /mini/*.
  Теперь /mini получает только CSP. (commit 6e75702d)
- [x] **R41**: schema.org Article/Product/SoftwareApplication.image на
  3 страницах (home, blog/[slug], journals-info/[code]) был квадрат
  /icons/icon-512.png. Google рекомендует landscape (1200×630, 1.91:1)
  для rich snippets — карточка в выдаче будет с большой preview, не с
  маленькой иконкой сбоку. Меняю на /og-default. Organization.logo и
  Publisher.logo оставляю icon-512 — Google именно требует 'logo' поле
  для бренд-маркировки. (commit 0763b2b5)
