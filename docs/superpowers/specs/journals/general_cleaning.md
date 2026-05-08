# Journal `general_cleaning` — График и учет генеральных уборок

**Tier:** C (ХАССП-рекомендуемый)

## Назначение

Per-помещение график проведения генеральных уборок (раз в месяц / раз
в неделю). Альтернатива/дополнение к `cleaning` журналу с фокусом на
плановых ГУ. Может быть консолидирован с **cleaning** через scheduleType=monthly
+ generalDays/MonthDays на Room.

## Колонки

| # | Колонка | Тип |
|---|---------|-----|
| 1 | Помещение | text (auto из rooms) |
| 2 | Дата плановая | date |
| 3 | Дата фактическая | date |
| 4 | Исполнитель | text (auto) |
| 5 | Использованные средства | text |
| 6 | Состояние помещения после ГУ | select (Норма / Отклонения) |
| 7 | Подпись отв. лица | signature |
| 8 | Фото после ГУ | photo (required) |

## Ритм

Monthly (обычно 1-я или последняя суббота месяца).

## Pipeline (TF task)

Большой wizard по чек-листу (см. sanitary_day_control но узко по уборке без ревизии).

## TasksFlow flow

- **Type:** monthly per помещение
- **rowKey:** `general-cleaning::{roomId}::{monthStart}`

## Status

После cleaning-unification 2026-05-08 — этот журнал **может быть закрыт**
в пользу настройки `Room.generalDays` или `Room.generalMonthDays` в
основном `cleaning`-журнале. Решение остаётся за пользователем.

## Sources

- См. cleaning-unification spec
