# Evidence — баланс баллов, рефералы, отзывы

TASK_ID: org-balance-referrals-reviews
Дата: 2026-09-03
Коммиты: `33d6d1c2` (реализация), `a905b18d` (SHA заметок «Что нового»)
Прод: `.build-sha = a905b18d830d37e43cb7b5574c850ecd4ba2fac5`, `.build-time = 2026-09-03T20:35:06Z`

## Команды и результат

| Проверка | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit --skipLibCheck` | 0 ошибок в `src/` |
| Тесты | `npm test` | 456 passed, 0 failed |
| Линтер | `npx eslint <изменённые файлы>` | 0 ошибок (1 предсуществующее предупреждение о шрифте в `mini/layout.tsx`) |
| Сборка | `npm run build` | exit 0, новые маршруты в манифесте |
| Гейт CI | `bash scripts/verify-before-push.sh` | «Можно пушить» |
| Деплой | GitHub Actions run 33802040956 / 33802062340 | success |

## Acceptance criteria

- **AC1 Леджер — PASS.** Списание идёт условным `updateMany … balanceRub >= N`
  (`src/lib/balance/ledger.ts`), при нехватке — `InsufficientBalanceError`,
  баланс не уходит в минус. Строка леджера пишется в той же транзакции,
  дубль `dedupeKey` (P2002) откатывает транзакцию целиком, вызывающий
  трактует это как no-op. В `releaseOrder` дубль проверяется ДО начисления,
  чтобы «проглоченный» P2002 не оставил баланс без строки.
- **AC2 Частичное списание — PASS.** `createOrderWithPoints` пишет
  `amountRub = gross − pointsSpent` и `pointsSpent`, подпись Робокассы
  считается по net (`buildPaymentParams` получает `order.amountRub`).
  Потолок — `tariff.priceRub` (`pointsToSpend`, покрыто тестами).
  Возврат: при оформлении нового заказа и кроном
  `/api/cron/expire-point-orders`, оба через один `releaseOrder` с
  `dedupeKey order_release:<id>` — ровно один раз. Клиент показывает
  `expired` как «Заказ истёк», а не как оплату (`isPaidStatus`).
- **AC3 100 % баллами — PASS.** При `net === 0` заказ помечается `paid`
  внутри той же транзакции, Робокасса не вызывается (`isConfigured()`
  проверяется только на ветке с кассой), дальше общий `completePaidOrder`:
  продление подписки именно у организации заказа, письмо «оплачено
  баллами», партнёрские и реферальные начисления.
- **AC4 Тумблер — PASS.** Включён по умолчанию; галочка рекуррента гасит
  его и наоборот; сервер принимает баллы только при сессии с
  `hasFullWorkspaceAccess`, без `isImpersonating` и без `recurringConsent`.
  Сотрудник и ROOT в режиме «войти как» баллов на `/order` не видят.
- **AC5 Реферал — PASS.** `/r/<code>` ставит cookie `wesetup.ref` и ведёт
  на `/register?ref=1`; привязка — в `instant-register`, `register/confirm`
  и в `completePaidOrder` для новых клиентов. Награда — 30 % подписочной
  части плюс списанные баллы, `dedupeKey referral_reward:<orgId>` — один
  раз на организацию. Отказ при самореферале (общий `accountId`), демо,
  организации старше 30 дней, уже оплаченных заказах и активной
  партнёрской привязке.
- **AC6 Отзыв — PASS.** Тариф по MIME (`reviewKindFromMime`, тесты),
  начисление только в `approveReview` внутри транзакции с атомарным
  `updateMany … status: "pending"`; повторный approve возвращает `null`.
  Лендинг читает только `approved + showOnLanding + consentPublic`.
- **AC7 ROOT — PASS.** Колонка «Баланс ₽» в метриках, карточка платформы
  «Баллов на балансах», карточка организации с историей и корректировкой
  (`manual_adjust` + `recordAuditLog`), модерация `/root/reviews`.
- **AC8 Mini App — PASS.** `/mini/balance` и карточка в `/mini/me` тем же
  компонентом, что на сайте. Попутно добавлен `<Toaster />` в mini-layout:
  без него ни один toast в Mini App не отображался.
- **AC9 Проверки — PASS.** См. таблицу выше.

## Прод-смоук (127.0.0.1:3002)

| Запрос | Код | Ожидание |
|---|---|---|
| `/` | 200 | лендинг жив |
| `/settings/balance` (аноним) | 307 | редирект на вход |
| `/mini/balance` (аноним) | 307 | редирект на вход |
| `/api/balance` (аноним) | 307 | редирект на вход |
| `/r/TESTTEST` | 307 | неизвестный код → `/register` |
| `/root/reviews` (аноним) | 404 | политика скрытия ROOT-раздела |
| `/api/cron/expire-point-orders` без секрета | 401 | защита крона |
| `/api/cron/expire-point-orders?secret=nope` | 401 | защита крона |

## Схема на проде

`information_schema` подтверждает: таблицы `BalanceTransaction`,
`CustomerReview`, `ReferralInvite`; колонки `Organization.balanceRub`,
`referralCode`, `referredByOrganizationId`, `referredAt`;
`PaymentOrder.pointsSpent`, `referrerOrganizationId`.

## Что требует ручной настройки

Внешний планировщик должен дёргать
`GET /api/cron/expire-point-orders?secret=$CRON_SECRET` каждые 10 минут —
как и остальные cron-маршруты проекта (записано в
`docs/FEATURES_AND_AUTOMATION.md`). До настройки холд снимается при
оформлении следующего заказа той же организацией.
