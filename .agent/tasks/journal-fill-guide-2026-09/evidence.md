# journal-fill-guide-2026-09 — evidence

Дата: 2026-09-04. Среда: dev-сервер `localhost:3020` (`.env.local`), Playwright
Chromium (`channel: "chrome"`), throwaway-менеджер `e2e-fill-guide@wesetup.local`
в org «Кафе Тестовое 1» (`cmoe6rpt4000097ts71yb922y`). Скрипты:
`e2e/seed-user.ts`, `e2e/verify.ts` (полный прогон → `e2e/results.json`,
`ONLY=mini` → `e2e/results-mini.json`), `e2e/cleanup-user.ts`. Скриншоты — `shots/`.

## Проверки кода

| Проверка | Результат |
| --- | --- |
| `npm run typecheck` | PASS (exit 0) |
| `npm test` | PASS — 552 тестов, 0 упавших (в т.ч. новые `journal-ui-walkthroughs.test.ts`, `spotlight-geometry.test.ts`) |
| `npx eslint <затронутые файлы>` | 0 ошибок, 4 предупреждения `react-hooks/set-state-in-effect` (паттерн `setMounted` уже используется в репо) |
| `npm run lint` (весь репозиторий) | 24 ошибки в 4 файлах, к задаче не относятся и были до неё: `cleaning/scope-and-schedule-editors.tsx` (13), `resources/print-agent/setup.js` (5), `resources/print-agent/agent.js` (4), `task-fill/task-fill-field.tsx` (2) — см. `e2e/eslint.json` |

## Acceptance criteria

| AC | Результат | Доказательство |
| --- | --- | --- |
| AC1 кнопка «Как заполнить?» справа от «Инструкция» на hygiene и climate_control; нет на cleaning | PASS | `results.json`: `hygiene.buttonRightOfInstruction=true`, `climate.buttonRightOfInstruction=true`, `cleaningNoButton=true`; `shots/hygiene-02-no-reopen.png`, `shots/climate_control-02-no-reopen.png` |
| AC2 окно: шаги с мини-копиями + вкладка «Правила»; bottom-sheet на 390px в 90vh | PASS | `hygiene.stepCount=7`, `climate.stepCount=8`, `hasRulesTab=true`, `rulesTabHasSteps=true`; `results-mini.json`: `miniDialog.fits=true` (top 84.4, bottom 844 при vh 844); `shots/hygiene-03-dialog.png`, `shots/hygiene-06-doc-rules.png`, `shots/mini-02-dialog.png` |
| AC3 спотлайт: вырез = rect цели, «Шаг N из M», Назад/Далее/Готово, Esc; пропуск отсутствующих анкоров, fallback на мобиле | PASS | все шаги `delta=0` (кольцо ровно вокруг цели), `hasCutout=true`; hygiene doc 5 шагов, climate doc 6 шагов, list 2 шага; `escCloses=true`; `closedAfter=true` после «Готово»; mini doc: шаги status/temperature ушли на `staff-card` (fallback), `staff-card` mobileOnly показан; `shots/*-07-doc-step*.png`, `shots/mini-04-doc-step*.png`. `ringInViewport=false` у шага `autofill` — ложное срабатывание: полоса шире viewport (см. `shots/hygiene-07-doc-step4.png`, подсветка на месте) |
| AC4 `?tour=<stepId>` стартует нужный шаг, параметр исчезает, `?tab=` цел | PASS | `hygiene.queryTour`: открыт на «Отметьте осмотр за сегодня» (`status-cell`), url без `tour=`; `climate.queryTour`: «Впишите показания» (`measure-input`); `jumpToDocument.jumped=true` (переход список → документ с туром); `shots/*-08-query-tour.png`, `shots/*-09-jump.png` |
| AC5 автооткрытие один раз; reload и другой браузер не открывают | PASS | `autoOpen=true` (оба журнала), `reopenAfterReload=false`, `docAutoOpen=false`, `otherBrowserAutoOpen=false` (новый контекст, тот же аккаунт); `shots/*-01-auto-open.png` |
| AC6 Mini App: кнопка в списке вместо info-box, круглая кнопка над навигацией в документе, тур подсвечивает карточки | PASS | `results-mini.json`: `miniListButton=true`, `miniDocFab=true`, `miniFabAboveNav.above=true` (fabBottom 696), `miniDocTour` 5 шагов с `delta=0`; `shots/mini-01-list.png`, `shots/mini-03-doc.png`, `shots/mini-04-doc-step*.png` |
| AC7 круглая кнопка на журнале без walkthrough — прежний sheet | PASS | `cleaningNoButton=true`, `cleaningOldFab=true`, `cleaningOldSheet=true`; `shots/cleaning-old-sheet.png` |
| AC8 «К заполнению →» на /guide ведёт на список | PASS | `guideCta_hygiene="/journals/hygiene"`, `guideCta_climate_control="/journals/climate_control"` |
| AC9 typecheck / lint / test | PASS для затронутых файлов (см. таблицу выше); repo-wide lint содержит 24 не связанные с задачей ошибки, существовавшие до правок |

## Наблюдения вне scope

- `results-mini.json` → `miniFabAboveNav.navPosition="relative"`, `navTop=1000`: нижняя
  навигация Mini App (`MiniNav`, `fixed z-50`) в реальности `position: relative` —
  правило `.mini-root > * { position: relative; z-index: 1 }` в `mini-theme.css`
  не в `@layer` и перебивает Tailwind `.fixed`. Наш FAB и тур порталятся в body и
  не затронуты. Отдельная задача.
- В dev на `/mini/*` один раз всплыла hydration-warning «server rendered text didn't
  match» (Next dev overlay перехватывал клики в e2e); текст на сервере/клиенте
  расходится у `LiveClock` в `mini-shell.tsx`, к правкам задачи не относится.
