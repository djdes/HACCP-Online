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
- [/] **C9**: Demo-форма — требует значительной работы, **отложено**
- [/] **C10**: Видео — нет исходников, **отложено**

## Блок 3 — контент

- [x] **D11**: Секция «Безопасность данных» (173d2373)
- [x] **D12**: ROI калькулятор (173d2373)
- [/] **D13**: Кейс-стади — нет реальных данных, **отложено**
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

- **C9** (демо-форма): требует архитектурного обсуждения
- **C10** (видео): нет видеоматериалов
- **D13** (кейс-стади): нет реальных клиентских данных
- **Блок 5** (Telegram-бот wizard): большая фича
- **Блок 6** (маркетинг): оффлайн-задачи (обход кафе, реклама в Директе) — вне сферы кода
- **Блок 7-8** (мобилка, NFC, ФГИС, курсы, white-label): weeks-of-work проекты
