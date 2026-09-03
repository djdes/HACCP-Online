# Sandbox / 14-day trial (roadmap 3.1.4) — замороженная спецификация

Источник: `docs/FEATURES_AND_AUTOMATION.md`, задача 3.1.4 «Sandbox / 14-day trial».

> Goal: свежезарегистрированная org получает `subscriptionPlan: "trial"` с
> soft-лимитами: 50 записей/день, max 3 активных Tuya-датчика, AI-чат 20
> сообщений. По истечении 14 дней — модалка «продлить или сократить функционал».
> Acceptance: на 15-й день trial-org видит upgrade-CTA на дашборде, но журналы
> не блокируются (read-only fallback вместо hard-stop).

## 1. Что уже есть (не делать заново)

- `subscriptionPlan: "trial"` — default в схеме; регистрация ставит
  `subscriptionEnd = now + 14 дней` (`register/confirm`, `instant-register`).
- AI-квота 20 сообщений/мес — `Organization.aiMonthlyQuota/aiMonthlyMessagesLeft`,
  проверка в `/api/ai/sanpin-chat` и `/api/capa/[id]/suggest`.
- Бесплатный тариф `trial|free` (`isFreePlan`), платный `paid`; авто-переход
  на `paid` при >3 сотрудниках (`ensurePlanForHeadcount`), `BILLING_TEST_MODE`
  (по умолчанию включён: тарифы переключаются, оплата не берётся).

## 2. Решения и отклонения от ТЗ

| # | В ТЗ | Решение |
|---|------|---------|
| K1 | «middleware-проверка лимита перед write-операциями» | Edge-middleware не имеет доступа к Prisma. Лимит проверяется серверным helper'ом `trialWriteGate(orgId, count)` в каждом пользовательском write-эндпоинте журналов (см. §4) — непосредственно перед записью в БД |
| K2 | «50 записей/день» | Считаем ручные записи, прошедшие через гейт, счётчиком на организации (`trialWritesDayKey`, `trialWritesCount`), день — по таймзоне организации. Автозаполнение кроном и IoT-замеры в лимит не входят: иначе 9 автожурналов исчерпывали бы квоту к 06:00 |
| K3 | «max 3 активных Tuya-датчика» | Гейт при привязке `tuyaDeviceId` к оборудованию (`POST /api/equipment`, `PUT /api/equipment/[id]`): при 3 уже привязанных — 402 `trial_sensor_limit`. Ранее привязанные датчики не отключаются |
| K4 | «AI-чат 20 сообщений» | Уже реализовано; показываем остаток в карточке тестового периода |
| K5 | Тестовый режим биллинга | Как и лимит на сотрудников: в `BILLING_TEST_MODE` лимиты считаются и показываются, но не блокируют. Блокировка (402) включается при `BILLING_TEST_MODE=0` |
| K6 | «продлить или сократить функционал» | «Продлить» = оформить подписку (`/settings/subscription`, существующий upgrade). «Сократить функционал» = остаться на бесплатном тарифе: `subscriptionPlan: "free"` (org + account), лимиты остаются, модалка больше не показывается. «Напомнить позже» — до конца сессии |
| K7 | «read-only fallback вместо hard-stop» | При исчерпании дневного лимита write-эндпоинты отвечают 402 с понятным текстом; чтение, печать, PDF, настройки — без изменений. Ничего не блокируется целиком |
| K8 | Дата конца теста | `subscriptionEnd` (ставится при регистрации; ROOT может продлить в карточке организации), fallback — `createdAt + 14 дней` |
| K9 | Mini App (П-3) | В сводке менеджера — строка о тестовом периоде (осталось дней / закончился) |

## 3. Модель данных

`Organization.trialWritesDayKey String?`, `Organization.trialWritesCount Int @default(0)` — `prisma db push`.

## 4. Точки применения дневного лимита

`POST /api/journals`; `PUT|PATCH /api/journal-documents/[id]/entries`;
`POST /api/journal-documents/[id]/entries/bulk`; `copy-yesterday`; `climate`;
`cold-equipment`; `equipment-cleaning` (POST/PATCH); `fryer-oil` (POST/PATCH);
`pest-control-entries` (POST/PATCH); `POST /api/mini/documents/[id]/entries`
(новая запись из Mini App идёт в тот же `POST /api/journals`); `POST /api/mini/journals/[code]/bulk-copy-yesterday`;
`POST /api/task-fill/[taskId]`; `POST /api/equipment-fill/[equipmentId]`;
`POST /api/dashboard/catch-up`; `POST /api/external/entries`; действия AI-помощника
(`executeFillCells`).

Не гейтим: кроны автозаполнения, IoT-pull, `close-day` («не требуется»), config-эндпоинты (`staff`, `verifier`).

## 5. Критерии приёмки

- AC1. `getTrialStatus`: trial + `subscriptionEnd` в будущем → `phase: "trial"`, `daysLeft` верный; `now >= subscriptionEnd` → `"expired"`; без `subscriptionEnd` — от `createdAt + 14 д`; `free` → `"free"`; `paid` → `"paid"` (лимиты не действуют). Покрыто тестами.
- AC2. Дневной лимит: при `BILLING_TEST_MODE=0` 51-я ручная запись в день на бесплатном тарифе → HTTP 402 `{ code: "trial_daily_limit" }`; на `paid` — без ограничений; в тестовом режиме — не блокирует. Решение — чистая функция с тестами.
- AC3. Лимит датчиков: 4-й `tuyaDeviceId` на бесплатном тарифе при `BILLING_TEST_MODE=0` → 402 `trial_sensor_limit`.
- AC4. Дашборд: на бесплатном тарифе карточка тестового периода с днями, счётчиками (записи/день, датчики, AI) и CTA «Перейти на подписку»; после окончания теста — модалка «Продлить / Сократить функционал / Напомнить позже».
- AC5. «Сократить функционал» → `POST /api/settings/subscription/trial-decision` → `subscriptionPlan: "free"`, аудит `plan.trial_reduced`, модалка больше не показывается, карточка с CTA остаётся.
- AC6. Mini App: менеджер видит строку о тестовом периоде в сводке.
- AC7. Регистрация использует одну константу `TRIAL_DAYS` из `src/lib/trial.ts`.
- AC8. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — без ошибок в затронутых файлах; задача убрана из roadmap, добавлена в «Recently shipped»; `whats-new-notes.ts` обновлён.
