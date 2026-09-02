# partner-cabinet — evidence

Дата проверки: 2026-09-02. Ветка `master`, рабочее дерево до коммита фичи.

## Команды и результат

| Команда | Результат |
|---|---|
| `npx tsc --noEmit --skipLibCheck \| grep "^src"` | пусто — ошибок в `src/` нет |
| `npm test` (`node --import tsx --test "src/**/*.test.ts"`) | `tests 377 / pass 377 / fail 0` |
| `npm run lint` (`npx eslint . -f json` + разбор) | 0 ошибок в файлах задачи; 24 ошибки — в нетронутых `resources/print-agent/*.js`, `src/components/cleaning/scope-and-schedule-editors.tsx`, `src/components/task-fill/task-fill-field.tsx` (без изменений в `git status`) |
| `npm run build` (`prisma generate` + `next build --webpack`) | `EXIT=0`; в манифесте собраны все маршруты `/p/[slug]*`, `/partner/*`, `/partners`, `/root/partners*`, `/api/partner/*`, `/api/partners/*`, `/api/root/partners/*`, `/api/settings/partner`, `/api/settings/consultant`, `/api/partner-assets/*`, `/api/cron/partner-month-close` |
| `grep -rn "TODO\|FIXME\|заглушк" <файлы задачи>` | пусто |

## Критерии приёмки

| AC | Статус | Где реализовано / чем подтверждено |
|---|---|---|
| AC1 заявка → одобрение → `/partner` с онбордингом, письмо + Telegram | PASS | `src/app/(dashboard)/settings/partner/*`, `src/app/partners/page.tsx`, `src/app/api/settings/partner/route.ts`, `src/lib/partners/service.ts` (`applyForPartnership`, `reviewPartner`), `src/lib/partners/admin.ts`, `src/lib/partners/emails.ts`, `src/app/partner/layout.tsx` + `src/components/partner/onboarding-wizard.tsx` (3 шага), `src/app/root/partners/*`. Сессия получает `partnerAccess` в `src/lib/auth.ts` (`resolvePartnerSessionAccess`). |
| AC2 подключение по ссылке `/p/<slug>` и коду; своя организация — отказ | PASS | `src/app/p/[slug]/*`, `src/lib/partners/referral.ts` (cookie 30 дней, `attachOrganizationByRef`), `src/lib/partners/service.ts` (`findPartnerForAttach`, `attachOrganizationToPartner`, `isPartnerOwnOrganization` — ИНН/владелец/участник команды), `src/app/api/partners/attach|lookup|decline`, регистрация: `instant-register`, `register/confirm`. Тесты: `surfaces.test.ts` («поле «ссылка или код»…», «реферальная cookie…»), `validation.test.ts` (slug, код). |
| AC3 брендинг у клиента (шапка, акцент, «Ваш консультант», плашка платформы, PDF, письмо, бот); тумблер «стандартный интерфейс» | PASS | `src/lib/partners/branding.ts` (`getVisibleOrgBranding`, `PLATFORM_BADGE_TEXT`), `(dashboard)/layout.tsx`, `header.tsx`, `dashboard-footer.tsx`, `consultant-card.tsx`, `support-widget.tsx`, `app-theme.css` (`[data-partner-accent]`), `pdf-page-labels.ts` (`stampPartnerPdfFooter`), `document-pdf.ts`, `paper-journal-pdf.ts`, `email.ts` (`emailBrandForOrganization`), `telegram.ts` (`telegramConsultantFooter`), bot `/start`. Тумблер — `settings/consultant` → `setClientHidesBranding`. Тесты: `surfaces.test.ts` (PDF-подвал, href контактов, приветствие бота). Кэш брендинга ≤ 5 мин — `branding.ts`. |
| AC4 `view` → 403 на мутациях, «Инспектор» недоступен; `edit` — пометка в аудите | PASS | `src/middleware.ts` (`evaluatePartnerRequest`), `src/lib/partners/access-guard.ts`, `src/lib/server-session.ts` (`enforcePartnerWriteGuard`), `src/lib/db.ts` + `src/lib/partners/audit-marker.ts` (маркер «партнёр: …» в `AuditLog`), `partner-access-banner.tsx`. Тест: `validation.test.ts` («доступ партнёра: view — только чтение, edit — без денег и настроек», «claim из JWT парсится строго»). |
| AC5 20 % с подписки, бонус 3 000 ₽ со 2-го платежа, оборудование 15 % после отгрузки, сторно | PASS | `src/lib/partners/accruals.ts` (`accrueForPaidOrder`, `accrueHardwareShipped`, `reverseOrderAccruals`, `markOrderShipped`, `markOrderRefunded`), `src/lib/partners/rewards.ts`, вызов из `src/app/payment/route.ts` (Robokassa result-callback); ROOT-отметки «Отгружено»/«Возврат» — `api/root/partners/orders/[orderId]`. Тесты: `rewards.test.ts` (1 990 → 398; второй платёж + 3 000; третий без бонуса; 17 750 → 2 662,50; сторно; окно 12 мес; версии правил; копеечная арифметика). Уникальность `(paymentOrderId, kind)` — `prisma/schema.prisma` `PartnerAccrual`. |
| AC6 закрытие месяца → `payable`; «Выплачено» с датой и № документа; минимум 1 000 ₽ с переносом | PASS | `src/app/api/cron/partner-month-close/route.ts`, `api/root/partners/payouts/close`, `api/root/partners/payouts/[partnerId]/paid`, `src/lib/partners/accruals.ts` (`closeMonth`, `markPartnerPaid`, `buildPayoutSheetForAdmin`). Тесты: `rewards.test.ts` («ведомость: ниже минимума — перенос», «ключ месяца считается по Москве…»). |
| AC7 CSV: UTF-8 BOM, `;`, кириллица | PASS | `src/lib/partners/csv.ts`, `api/partner/rewards/csv`, `api/root/partners/payouts?format=csv`. Тест: `validation.test.ts` («CSV: BOM, разделитель `;`, кириллица, экранирование…»). |
| AC8 обзор для N клиентов — фиксированное число запросов | PASS | `src/lib/partners/overview.ts` (`loadPartnerOverview`): 5 пакетных запросов по массиву `organizationId` (клиенты, записи за 7 дней, документы, медкнижки, платежи), число не зависит от количества клиентов; чистая агрегация `aggregateOverview` покрыта `overview.test.ts`. |
| AC9 отвязка клиентом/партнёром/ROOT → доступ теряется, брендинг снят, история сохранена, партнёр уведомлён | PASS | `src/lib/partners/service.ts` (`detachOrganizationFromPartner`, статус `detached` + `detachedAt`, запись остаётся), `api/settings/consultant` (DELETE), `api/partner/clients/[orgId]/detach`, `api/root/partners/[id]/clients/[orgId]/detach`; `resolvePartnerSessionAccess` перечитывает статус на каждом запросе; письмо партнёру — `emails.ts`. Тест: `overview.test.ts` («detached clients are kept as history…»). |
| AC10 typecheck / lint / test / build зелёные; unit-тесты по списку | PASS | См. таблицу команд. Покрытие: вознаграждения и сторно (`rewards.test.ts`), slug/HEX/контраст, SVG-sanitizer, PNG-IHDR, CSV, guard уровня доступа (`validation.test.ts`), окно 12 месяцев и закрытие месяца (`rewards.test.ts`), поверхности брендинга (`surfaces.test.ts`), агрегация обзора (`overview.test.ts`). |
| AC11 документы | PASS | `docs/partners-guide.md`, `docs/partners-client-guide.md`, `docs/partners-open-questions.md`. |

## Что не автоматизировано

Сквозные сценарии (реальная оплата через Robokassa, отправка писем/Telegram, рендер `/partner` в браузере) проверены сборкой маршрутов и типами, но не e2e-тестами — в репозитории нет e2e-контура для платёжного webhook'а. Ручная проверка на проде — после деплоя, см. `docs/partners-open-questions.md` (пункт про crontab закрытия месяца).
