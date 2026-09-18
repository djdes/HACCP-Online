# evidence — equipment-qr-modal-2026-09

Дата: 2026-09-18. Стенд: dev-сервер `localhost:3020` (Turbopack), БД — туннель в
прод, организация «Кафе „Тестовое 1“» (`cmoe6rpt4000097ts71yb922y`),
пользователь `e2e-fill-guide@wesetup.local` (manager).
Скрипты: `e2e/seed.ts` → `e2e/verify.ts` (AC1–AC5, AC7) → `e2e/verify-tail.ts`
(AC6, AC8) → `e2e/cleanup.ts`. Результаты: `e2e/results.json`,
`e2e/results-tail.json`. Скриншоты: `shots/*.png` (не в git).

| AC | Вердикт | Доказательство |
|----|---------|----------------|
| AC1 | PASS | Клик по «Тест QR А» в таблице → диалог «Редактирование оборудования»; «до» = 7 → Сохранить → `GET /api/equipment`: `tempMax: 7`, строка в таблице «Тест QR А / до 7°C» (`results.json: ac1_*`). |
| AC2 | PASS | Строки, добавленные кнопкой «Добавить», сразу появились в справочнике: «Тест QR А» (refrigerator, цех «Основной цех» создан автоматически), «Тест QR Б» (freezer, tempMax −18) (`ac2_directoryCreated`). Диалог показывает QR (скриншот `02-cold-dialog-qr.png`, `10-mini-dialog-qr.png`). |
| AC3 | PASS | `GET /api/qr-fill/equipment/<id>` → `url` = `/equipment-fill/<id>?token=…`, `verifyQrFillToken` → ok/kind=equipment/id совпадает, SVG есть; публичная страница заполнения отвечает 200 и принимает токен (`ac3_qr`). |
| AC4 | PASS | «Плакат A4» → `/settings/qr-posters?kind=equipment&layout=poster&ids=<id>&autoprint=1`, «Наклейка» → `layout=sheet…&autoprint=1`; на каждой странице 1 объект и `window.print()` вызван 1 раз (`ac4_autoprint`, `ac4_poster`). |
| AC5 | PASS | Выделены 2 строки → полоса «Выбрано: 2 … QR-коды Удалить» → переход на `/settings/qr-posters?kind=equipment&layout=sheet&ids=a,b`; 2 наклейки «Тест QR А», «Тест QR Б»; в `@media print` сетка 3 колонки, `break-inside: avoid` (`ac5_*`, `05-sheet-print.png`). |
| AC6 | PASS | Климат: помещение «E2E Склад QR» из справочника → клик по названию → «Редактирование помещения», секция «Климат» с QR; `GET /api/qr-fill/room/<id>` → `/room-fill/<id>?token=…`, токен ok, нормы «18…25 °C, 15…75 %», страница `/room-fill` принимает токен (`results-tail.json: ac6_room`, `08-climate-room-qr.png`). |
| AC7 | PASS | `/settings/equipment/qr-sheet` → `/settings/qr-posters?kind=equipment&layout=sheet` (`ac7_redirect`). |
| AC8 | PASS | `/mini/documents/<coldDoc>` (390px): 2 карандаша «Изменить Тест QR …» в карточках дня, 2 кнопки-названия в таблице; клик → диалог с QR (`ac8_*`, `10-mini-dialog-qr.png`). |
| AC9 | PASS | `npm run typecheck` — чисто; `eslint` по изменённым файлам — 0 ошибок (5 предупреждений `no-unused-vars` были до правки). `NEXT_DIST_DIR=.next-parity npm run build` (webpack) — см. `parity-build.log`. |

Побочно исправлено: `normalizeColdEquipmentDocumentConfig` терял
`readingMode` строки; у новой строки пресет «Холодильное» был подсвечен,
но норма не подставлялась.

Откат: `cleanup.ts` удалил 2 записи оборудования, цех «Основной цех»,
здание/помещение посева и вернул конфиги документов (`db-probe2.ts`:
buildings `[]`, areas `[]`).

## Прод (2026-09-18, после деплоя 3fd22a16)

`e2e/prod-smoke.ts` (read-only): `.build-sha` = `3fd22a16…`, `/login` 200;
окно «Добавление оборудования» с подсказкой про QR и подставленной нормой
«от 2»; `/settings/qr-posters?…&layout=sheet` — «QR-наклейки», вкладки
«Плакат на лист / Наклейки на лист»; `/settings/equipment/qr-sheet` →
редирект; `GET /api/qr-fill/equipment/<нет>` 404, неизвестный вид — 400;
ошибок 5xx и `pageerror` нет (`e2e/prod-smoke.json`).
