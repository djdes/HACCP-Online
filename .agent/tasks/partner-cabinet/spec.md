# Партнёрский кабинет и white-label брендинг (B8) — замороженная спецификация

Источник: ТЗ `TZ_partner_cabinet_whitelabel.md` (разделы 1–12). Ниже — критика
ТЗ относительно текущей архитектуры Wesetup, принятые решения и критерии
приёмки, по которым проверяется результат.

## 1. Критика ТЗ и принятые отклонения

| # | В ТЗ | Проблема в нашей архитектуре | Решение |
|---|------|------------------------------|---------|
| K1 | Админка `/admin/partners` | Админка платформы уже живёт в `/root/*` (+ `/api/root/*`, 404-cloaking в middleware) | Все админ-экраны — `/root/partners`, `/root/partners/[id]`, `/root/partners/rules`, `/root/partners/payouts` |
| K2 | Роли `partner_owner` / `partner_member` в `User.role` | `User.role` — должность внутри организации, от неё зависят права и терминология. Партнёрская роль ортогональна | Отдельная таблица `PartnerUser(partnerId, userId, role: owner\|member)`. В сессию/JWT роль партнёра не пишется — кабинет `/partner` проверяет членство в БД |
| K3 | «Партнёр видит те же экраны, что админ клиента» | Дублировать 60+ экранов в read-only виде нельзя | Партнёр «входит» в организацию клиента тем же механизмом, что multi-org (`activeOrganizationId` в JWT) + claim `partnerAccess {partnerId, level}`. Сессионный callback на каждом запросе перепроверяет активную привязку `PartnerClient` → отвязка действует мгновенно. Уровень `view`: middleware отвечает 403 на любой мутирующий запрос (`POST/PUT/PATCH/DELETE`) вне allow-list; страховочный второй слой — `getServerSession` отдаёт `null` для мутаций при свежем уровне `view` (случай, когда клиент понизил уровень, а JWT ещё «edit») |
| K4 | Возврат средств → сторно | В коде нет процесса возвратов (Робокасса-возврат делается вручную по заявлению) | ROOT в карточке организации (список платежей) нажимает «Отметить возврат» на заказе → `PaymentOrder.refundedAt` + сторно всех начислений заказа (`*_reversal`, отрицательная сумма) |
| K5 | «Оборудование: после пометки заказа оплачен и отгружен» | Отдельной таблицы заказов оборудования нет: комплект = один `PaymentOrder` с `bundleConfig` | База для «подписки» в комплекте = `amountRub − hardwareTotal(bundleConfig)`; база «оборудования» = `hardwareTotal(bundleConfig)`. Отгрузку отмечает ROOT («Отгружено») → `PaymentOrder.shippedAt` → начисление hardware 15 % |
| K6 | Partial unique index `where detached_at is null` | Схема раскатывается `prisma db push`; partial-индексы Prisma не описывает | Уникальность «один активный партнёр на организацию» гарантируется транзакцией с `SELECT … FOR UPDATE`-семантикой (проверка + insert в одной транзакции) и `@@index([organizationId, detachedAt])`. Partial-индекс дополнительно создаётся идемпотентно через `db.$executeRawUnsafe(CREATE UNIQUE INDEX IF NOT EXISTS …)` в `ensurePartnerSchemaExtras()` при первом обращении к партнёрскому API |
| K7 | Уникальность `(payment_id, kind)` при сторно | Одно сторно на каждое начисление заказа | Виды: `subscription`, `hardware`, `bonus` и их сторно `subscription_reversal`, `hardware_reversal`, `bonus_reversal`; уникальность `(paymentOrderId, kind)` сохраняется |
| K8 | Обрезка логотипа до 240×64 на сервере | На сервере нет `sharp` | PNG нормализуется в браузере (canvas, вписывание в 480×128 = 240×64 @2x, прозрачные поля), сервер проверяет сигнатуру PNG, размеры из IHDR (≤ 480×128) и вес ≤ 500 KB. SVG хранится как есть после sanitize (векторный, масштабируется CSS) |
| K9 | Sanitize SVG | Нет DOMPurify/svgo | Собственный sanitizer: отклоняет `<script`, `on*=`, `javascript:`, `<foreignObject`, `<iframe/embed/object`, `<!ENTITY`, внешние `href/xlink:href/url()`, `<?xml-stylesheet`; удаляет комментарии. Отдаётся с CSP `sandbox` и `Content-Type: image/svg+xml` только через `<img>` |
| K10 | Контраст WCAG AA «с белым и тёмным текстом» | Дефолтный `#5566f6` даёт 4.55:1 к белому, но 4.17:1 к `#0b1024` | Правило: ≥ 4.5:1 к белому (текст на кнопке) и ≥ 3:1 к `#0b1024` (крупный текст/UI-компоненты, AA). Иначе — предупреждение и дефолтный акцент |
| K11 | «Активные (7 дней подряд с записями)» | Дорого считать «подряд» на 200 клиентов | Считаем по агрегату: организации, у которых есть записи в каждом из последних 7 календарных дней (одна `groupBy`-выборка по `JournalDocumentEntry`/`JournalEntry` за 7 дней) |
| K12 | Субдомен `<slug>.wesetup.ru` | Не в объёме | `resolvePartnerSlugFromHost(host)` в `src/lib/partners/branding.ts` — чистая функция с тестом; middleware её не вызывает |
| K13 | Email-приглашение «отказался» | Нужен явный сигнал | В письме ссылка «Не интересно» → `/p/<slug>/decline?token=` → статус `declined` |
| K14 | Отдельный бот, оферта, тарифы | Не в объёме | Не трогаем `/oferta`, `PlatformTariff`, текст согласий |

## 2. Модель данных (Prisma, `db push`)

`Partner`, `PartnerUser`, `PartnerBranding`, `PartnerClient`, `PartnerClientNote`,
`PartnerInvite`, `PartnerRewardRule`, `PartnerAccrual`; `PaymentOrder` +
`partnerSlug`, `shippedAt`, `refundedAt`. Точные поля — в `prisma/schema.prisma`.

## 3. Маршруты

Публичные: `/partners` (страница «Стать партнёром» + форма заявки для
неавторизованных → регистрация), `/p/[slug]` (брендированный вход/регистрация,
подключение к текущей организации), `/p/[slug]/decline`.

Клиент: `/settings/consultant` (код/ссылка, уровень, скрыть брендинг,
отвязать), `/settings/partner` (заявка / статус / переход в кабинет).

Партнёр: `/partner` (обзор), `/partner/clients/[orgId]` (карточка), `/partner/invites`,
`/partner/branding`, `/partner/rewards`, `/partner/team`, `/partner/onboarding`.

ROOT: `/root/partners`, `/root/partners/[id]`, `/root/partners/rules`, `/root/partners/payouts`.

API: `/api/partners/apply`, `/api/partners/attach`, `/api/partner/*`,
`/api/settings/consultant`, `/api/root/partners/*`, `/api/partner-assets/[partnerId]/logo`,
`/api/cron/partner-month-close`.

## 4. Критерии приёмки

- AC1. Заявка → ROOT одобряет → у заявителя появляется `/partner` с онбордингом (3 шага), письмо и Telegram-уведомление отправлены.
- AC2. Подключение по ссылке `/p/<slug>` (новая регистрация) и по коду (существующая организация); собственная организация партнёра (по ИНН/владельцу) — отказ.
- AC3. Брендинг применён у клиента (логотип в шапке, акцент, блок «Ваш консультант», футер «Работает на платформе WeSetup», PDF-подпись, письмо, бот); изменения видны ≤ 5 мин; переключатель клиента «Показывать стандартный интерфейс» убирает брендинг, привязка остаётся.
- AC4. Уровень `view`: мутирующий запрос к `/api/*` → 403; «Инспектор пришёл» недоступен; уровень `edit` — записи разрешены, в аудите пометка «партнёр: …».
- AC5. Оплата подписки 1 990 ₽ → начисление 398 ₽ (20 %); второй платёж → +398 ₽ и бонус 3 000 ₽; возврат → сторно; комплект с оборудованием 17 750 ₽ после «Отгружено» → 2 662,50 ₽.
- AC6. Закрытие месяца 1-го числа → `accrued → payable`; ROOT отмечает «Выплачено» (дата, № документа); минимум 1 000 ₽ с переносом остатка.
- AC7. CSV начислений: UTF-8 BOM, `;`, открывается в Excel с кириллицей.
- AC8. Обзор для 200 клиентов — фиксированное число запросов (≤ 6), не зависящее от числа клиентов.
- AC9. Отвязка (клиент/партнёр/ROOT) → доступ партнёра теряется при следующем запросе, брендинг снят, история сохранена, партнёр уведомлён.
- AC10. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — зелёные; unit-тесты покрывают расчёт вознаграждений, сторно, валидацию slug/HEX/контраста, sanitizer SVG, PNG-IHDR, CSV, guard уровня доступа, окно 12 месяцев, закрытие месяца.
- AC11. Документы `docs/partners-guide.md` (1 стр.), `docs/partners-client-guide.md` (0,5 стр.), `docs/partners-open-questions.md`.
