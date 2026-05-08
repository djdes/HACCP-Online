# Journal `cleaning_ventilation_checklist` — Чек-лист уборки и проветривания помещений

**Tier:** C (ХАССП-рекомендуемый)

## Назначение

Per-смена / per-слот фиксация проветривания + уборки. Структура —
матрица «помещение × процедура × слот времени».

## Структура

| # | Поле | Тип |
|---|------|-----|
| 1 | Помещение | text (auto из rooms) |
| 2 | Дата | date |
| 3 | Процедуры (массив) | array |
| | • id | text |
| | • label (например «Влажная уборка», «Проветривание») | text |
| | • times (плановые слоты HH:MM) | array |
| | • enabled | boolean |
| 4 | Фактически выполнено в слоте | datetime |
| 5 | Сотрудник | text (auto) |
| 6 | Подпись | signature |

## Ритм

Multi-slot daily (обычно 2-4 раза в день: утро, обед, вечер, перед закрытием).

## Pipeline (TF task)

Per-слот:
1. Шаг 1 — Открой окна / включи вентиляцию (длительность из config)
2. Шаг 2 — Сделай влажную уборку
3. Шаг 3 — Подтверди завершение

photoMode: optional.

## TasksFlow flow

- **Type:** N задач/день (per помещение × слот)
- **rowKey:** `vent-clean::{roomId}::{date}::{slotTime}`

## Compliance rule

`DEEP_INSPECT_CODES` includes `cleaning_ventilation_checklist`. Проверяет
что каждый слот заполнен. Default-fill из config, override — JournalDocumentEntry.

## Связи

При работе кондиционеров / усиленном проветривании летом → можно
автоматически добавлять слоты.
