# Task: free-plan-mobile-polish-2026-09

Полный план: `C:\Users\djdes\.claude\plans\magical-whistling-meadow.md` (копия решений ниже).

## Acceptance criteria

- **AC1** Глобальное правило `flex-wrap` для `.app-shell main .flex.gap-3..6` (globals.css) удалено; панели из 2+ кнопок получили явный `flex-wrap`; на 390px страницы `/dashboard`, `/settings`, `/settings/partner`, `/settings/subscription`, `/settings/auto-journals`, `/settings/journals`, `/journals/cleaning`, `/verifications`, `/mini` не имеют элементов, выходящих за viewport.
- **AC2** Партнёрская модалка на 390px помещается в экран (bottom-sheet, `max-h ≤ 88vh`), плитки ставок и макет white-label не переполняются; на 1440px выглядит как раньше.
- **AC3** Форма заявки партнёра: обязательные поля помечены `*`, необязательные — «не обязательно», чекбокс согласия через `Checkbox` в одной строке с текстом, подсказка под кнопкой при неотмеченном согласии.
- **AC4** Концепция trial удалена: нет `src/lib/trial*.ts`, карточки/модалки, гейтов `trialWriteGate`/`trialSensorGate`/`consumeTrialWrite`, AI-квоты (`aiMonthly*`, `reset-ai-quota`), дефолт плана `free`, `trial` читается как алиас; `rg "TRIAL_|trialWrite|aiMonthly|messagesLeft|quotaExceeded|reset-ai-quota" src` → 0.
- **AC5** Тексты про 14 дней/лимиты заменены на «бесплатно до 3 сотрудников, без ограничений» (лендинг, подписка, письма, Mini App); скрипт `scripts/migrate-trial-to-free.ts` с dry-run и `--apply`.
- **AC6** Auto-pause: порог 100 дней, письма за 30/14/7/3/2/1 день (дедуп по стадии и дате активности), письмо о паузе, `pausedFromPlan`, кнопка «Возобновить работу» на `/settings/subscription` + `POST /api/settings/subscription/resume`, автоматика журналов не работает для `paused`; unit-тесты планировщика стадий.
- **AC7** `npm run typecheck`, `npm test` зелёные; lint без новых ошибок.
- **AC8** whats-new обновлён, деплой прошёл, миграция trial→free выполнена на проде, crontab: ежедневный `auto-pause-inactive`.
