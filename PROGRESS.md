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

- [ ] **C5**: Порядок секций — current структура (после B/C/D правок) уже близка к рекомендуемой; перепроверить и возможно перетасовать
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

## Итоговое ревью /api/* эндпоинтов

Прошёлся по attack-surface и подтвердил безопасность (без новых правок):

- `/api/auth/login`: rate-limit (5/5min by IP), DUMMY_BCRYPT_HASH против user-enumeration, httpOnly+Secure+SameSite=Lax cookies ✅
- `/api/auth/register/confirm`: per-IP rate-limit (a914148e), DB attempts counter, bcrypt cost 12, atomic transaction, plan whitelist ✅
- `/api/mini/attachments`: type whitelist (jpg/png/webp), 5MB cap, mime-derived ext, multi-tenant entryId scope, audit log ✅
- `/api/ai/check-photo`: SSRF prevention via `^/uploads/[a-zA-Z0-9._-]{1,128}$` regex, AI rate-limit, requireApiAuth ✅
- `/api/journal-documents/<id>/verifier`: zod schema, multi-tenant scope, ownedEntryIds check, audit log на 4 действия ✅
- TF `/api/tasks/:id/mark-returned`: requireAuthOrApiKey, callerCompanyId scope, admin-only path, reason capped ✅

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
