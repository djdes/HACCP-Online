# Journal Overhaul State

## Last updated: 2026-04-28 (старт)

## Done
- (пусто)

## In progress
- (пусто) — следующий прогон должен взять `cleaning` для проверки reference + допилить.

## Next (priority order)
1. `cleaning` — REFERENCE проверка. Прочитать существующий код, убедиться что race-claim+one-task+TF mirror работают на 100%; допилить пробелы (особенно in-bound TasksFlow webhook). DO NOT rewrite, только дополнить и привести dashboard к design-system если ещё не приведён.
2. `hygiene` — гигиенический журнал.
3. `cold_equipment_control` — температуры холодильников.
4. `climate_control` — климат-контроль.
5. `incoming_control` — приёмка сырья.
6. `finished_product` — бракераж готовой продукции.
7. `disinfectant_usage` — дезсредства.
8. `fryer_oil` — фритюрный жир.
9. `med_books` — медкнижки.
10. `staff_training` — обучение персонала.
11. (далее по `JournalCatalog.sortOrder` — `accident_journal`, `complaint_register`, `equipment_calibration` и т.д.)

## Blockers
- (none)

## Notes / edge cases
- (пусто — будет накапливаться)

## Changelog
- 2026-04-28 — создан PROMPT.md и STATE.md, очередь сформирована.
