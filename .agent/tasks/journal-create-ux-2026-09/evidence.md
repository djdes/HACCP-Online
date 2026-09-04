# Evidence — journal-create-ux-2026-09

Дата: 2026-09-04. Локальный dev `next dev -p 3020`, БД из `.env.local`, org «Кафе „Тестовое 1“» (Повар×2, Официант×2, Шеф-повар×1, Управляющий×1), временный пользователь-менеджер (удалён после прогона).

## Команды
- `npm run typecheck` → exit 0
- `npm run lint` → 0 ошибок в изменённых файлах (4 ошибки `react-hooks/refs` в НЕтронутых `resources/print-agent/*.js`, `cleaning/scope-and-schedule-editors.tsx`, `task-fill/task-fill-field.tsx` — pre-existing, не в diff)
- `npm test` → 504 tests, 504 pass (в т.ч. 15 новых в `journal-document-title.test.ts`)
- `E2E_EMAIL=… E2E_PASSWORD=… npx tsx .agent/tasks/journal-create-ux-2026-09/e2e/local-verify.ts` → `e2e-results.json`, скриншоты в `shots/`

## Acceptance criteria
| AC | Результат | Доказательство |
|---|---|---|
| AC1 уборка: автоназвание | PASS — «Журнал уборки — 1–15 сентября 2026» | `e2e-results.json: ac1_title`, `shots/01-create-dialog.png`; дедуп « (2)» — unit-тест `buildDocumentAutoTitle` |
| AC2 годовые: «— 2026 год», смена года | PASS — план аудитов «— 2026 год» → после выбора 2027 «— 2027 год»; СИЗ «Журнал учета выдачи СИЗ — 2026 год» | `ac2_audit_plan_title*`, `ac2_ppe_title`, `shots/06-audit-plan-create.png`, `07-ppe_issuance-create.png` |
| AC3 бессрочные без периода | PASS — «Журнал учета дез. средств» | `ac3_disinfectant_title`, `shots/07-disinfectant_usage-create.png` |
| AC4 автооткрытие при 2+ | PASS — после «Повар» список сотрудников открыт, фокус внутри, Escape закрывает | `ac4_employee_list_after_position.open/focusInside`, `ac4_escape_closes`, `shots/03-employee-auto-open.png` |
| AC5 стиль панели | PASS — panelClass содержит `rounded-2xl border-[#ececf4] shadow-[…]`, группы «РУКОВОДСТВО · 2» / «СОТРУДНИКИ · 2» с иконками, список под полем на ширину поля | `ac5_position_list`, `shots/02-position-select-open.png`, `04-card-dropdown-menu.png` |
| AC6 mobile 390px | PASS — right=333.75 ≤ 390 | `ac6_mobile.fits=true`, `shots/05-mobile-position-select.png` |
| AC7 ручные каскады | PASS — «Настройки» гигиены (мигрирован на picker): смена должности на «Официант» → список открыт с фокусом | `ac7_hygiene_*`, `shots/08-hygiene-settings-auto-open.png`; остальные файлы — typecheck + lint |
| AC8 typecheck/lint/test | PASS | см. команды |
| AC9 what's new | PASS — категории «Журналы», «Интерфейс»; SHA — отдельным коммитом | `src/lib/whats-new-notes.ts` |

## Отклонения от плана
- Внутридокументные каскады (~30 мест) переведены не на компонент, а на общий хук `usePositionEmployeeCascade` — раскладки и словари должностей не тронуты (см. план, часть C).
- Диалоги с `state || props.initial` (audit-plan, training-plan, ppe, sanitation-day, accident, breakdown, cleaning-ventilation, disinfectant) сбрасывались только в `Dialog.onOpenChange(true)`, который не срабатывает при программном открытии — сброс перенесён в `useEffect([open])`.
