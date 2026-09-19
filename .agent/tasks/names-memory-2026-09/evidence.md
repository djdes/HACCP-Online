# evidence — names-memory-2026-09

Дата: 2026-09-19. Стенд: dev `localhost:3020`, БД — туннель в прод, организация
«Кафе „Тестовое 1“», Playwright 390×844 (`isMobile`). Скрипты: `e2e/db-probe.ts`
(документы → `docs.json`), `e2e/toggle-journals.ts enable|restore|cleanup-names`,
`e2e/verify.ts` → `e2e/results.json`. Скриншоты `shots/*.png` (не в git).

| AC | Вердикт | Доказательство |
|----|---------|----------------|
| AC1 | PASS | Бракераж: строка «E2E Блюдо 99072» сохранена → `GET /api/name-suggestions?scope=dish` первым отдаёт её; в новом окне бракеража и в окне интенсивного охлаждения она первая в списке (`ac1_apiFirst`, `ac1_listFirst`, `ac1_icFirst`). |
| AC2 | PASS | Скоропорт: «E2E Продукт 99072» → `scope=product` первым; в окне входного контроля первая кнопка списка продукции — она (`ac2_*`). |
| AC3 | PASS | Окно бракеража на 390px: `scrollWidth 390 = clientWidth 390`; дата (правый край 191) и время (левый край 199) не пересекаются, время не выходит за экран (`ac3_*`, `01-fp-dialog.png`). |
| AC4 | PASS | «Да» по умолчанию `aria-checked=true` с галочкой, «Нет» белое; клик по «Нет» переключает (`ac4_*`). В скоропорте «Соответствует» отмечено, «Не соответствует» — нет (`ac2_prButtons`, `04-pr-dialog.png`). |
| AC5 | PASS | Новая строка бракеража: оценка «Отлично» (`ac5_rating`). |
| AC6 | PASS | `/mini/documents/<бракераж>`: без горизонтального скролла, «Да» отмечено, оценка «Отлично», первая подсказка — то же блюдо (`ac6_mini`, `06-mini-dialog.png`). |
| AC7 | PASS | `node --test src/lib/name-suggestions.test.ts` 5/5; `npm run typecheck` чисто; eslint по изменённым файлам — 0 ошибок. `prisma db push` — таблица `NameSuggestion` создана. |

Откат: `cleanup-names` удалил тестовые подсказки и строки «E2E …»
(бракераж, скоропорт, пустую строку охлаждения), `restore` вернул список
отключённых журналов организации.
