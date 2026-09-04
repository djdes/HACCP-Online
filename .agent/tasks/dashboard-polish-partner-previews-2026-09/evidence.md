# Evidence — dashboard-polish-partner-previews-2026-09

Дата: 2026-09-04. Локальная проверка: `next dev -p 3020`, Playwright (`channel: "chrome"`),
скрипт `e2e/local-verify.ts`, результаты `shots/results.json`, скриншоты `shots/*.png`.
Тестовый менеджер создавался `e2e/seed-user.ts create` в org «Кафе „Тестовое 1“» и удалён после прогона.

| AC | Статус | Доказательство |
|---|---|---|
| AC1 нейтральные бумажные карточки | PASS | `results.dashboard.paperClasses` = `border-[#ececf4] bg-[#fafbff] hover:border-[#5566f6]/40`; электронные остались `border-[#ffd2cd]` (не заполнены) — `01-dashboard-desktop.png` |
| AC2 скрыть/включить в /journals | PASS | 35 кнопок «Скрыть» у менеджера; `04-hide-confirm.png` (ConfirmDialog), `05-after-hide.png` (toast «Журнал скрыт: Гигиенический журнал», секция «Отключённые журналы»), `enabledBack.stillHasHideBtnFor = 1` после «Включить» |
| AC3 мобильная шапка | PASS | `07-dashboard-mobile-summary.png`: «Обязательные / журналы 0/35», настройка иконкой (36×36), «Закрыть день» и «Выборочно» в одной строке (`sameRowButtons = true`), `scrollW = vw = 390` |
| AC4 модалка партнёрства | PASS | `02-partner-modal.png`; `partnerModal.hasRates = true` (20 % / 15 % / 3 000 ₽ из `getCurrentRewardRule`), `hasCta = true` (`/settings/partner`), высота 691 px < 90vh |
| AC5 скрытие иконки | PASS | `src/lib/partners/partner-hint.test.ts` — 5 тестов (`decidePartnerHint`), `npm test` 542/542 |
| AC6 модель + cron | PASS | `prisma db push` OK; `GET /api/cron/journal-previews` → `{"ok":true,"rendered":60,"failed":0,"skipped":578,"deleted":0,"ms":53459}`; `render.test.ts` (PNG 1228×862 из jsPDF), `service.test.ts` (4 теста планировщика) |
| AC7 раздача PNG | PASS | `previewFetch`: 200, `image/png`, `Cache-Control: private, max-age=31536000, immutable`, 84–236 КБ |
| AC8 карточки со снимками | PASS | `results.dashboard.previewImgs = 20`, `sampleImgs = 20` (остальные без активного документа → образец); на мобиле видны снимки «Карточка истории поломок · 2026 г.» и др.; бумажные — `paper_*.png` |
| AC9 typecheck/lint/tests | PASS | `npm run typecheck` exit 0; `npm test` 542 pass; `npm run lint` — 24 ошибок все в `.claude/skills/animate/examples/*` и `prisma/seed-admin.ts` (pre-existing, `require()`), в изменённых файлах 0 ошибок |
| AC10 деплой и crontab | PASS | Деплой 8b145777 (GitHub Actions success), PM2 online, `/login` 200. Crontab прода: `*/10 * * * * curl … /api/cron/journal-previews`. Ручной вызов на проде: `{"ok":true,"rendered":60,"failed":0,"skipped":218,"deleted":0,"ms":21296}` |

## Прод: два промежуточных деплоя
- 593854e8 — рендер падал: `import.meta.url` в webpack-сборке → числовой id модуля.
- 8b145777 — исправлено: пути pdfjs от `process.cwd()/node_modules`, canvas статическим импортом; локальная проверка через `NEXT_DIST_DIR=.next-prodcheck npm run build` (webpack, как на проде) дала 60/0 до пуша.

## Найдено и исправлено по ходу
- pdfjs в Next-бандле не находил `pdf.worker.mjs` → `serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"]` + `GlobalWorkerOptions.workerSrc` = file:// на node_modules.
- Глобальный `Cache-Control: no-store` из `next.config.ts` перекрывал заголовки роута → `api/journal-previews` добавлен в исключение.
- Бейдж-счётчик на 390px падал на отдельную строку → последнее слово заголовка и бейдж обёрнуты в `whitespace-nowrap`.

## Не проверено вручную
- Mini App шапка (иконка партнёрства): требует Telegram-авторизацию; покрыто typecheck и тем же helper'ом, что на сайте.
- Hydration-warning на /dashboard (`<script>` vs `<div>`) — pre-existing, от `DashboardSectionPersistScript`, к задаче не относится.
