# Journal `traceability_test` — Журнал прослеживаемости продукции

**Tier:** C (обязателен по ТР ТС 021/2011 ст. 8)

## Назначение

Сквозное отслеживание партии (batchKey) от приёмки сырья → использования
в готовых блюдах → списания. По ТР ТС 021/2011 предприятие должно за
1 минуту восстановить путь любой партии для отзыва при инциденте
безопасности.

## Колонки (per партия)

| # | Колонка | Тип |
|---|---------|-----|
| 1 | batchKey | text (auto, primary key) |
| 2 | Наименование сырья | text |
| 3 | Поставщик | text |
| 4 | Дата приёмки | date |
| 5 | Использование в блюдах (список) | array (link to finished_product entries) |
| 6 | Списания (список) | array (link to product_writeoff entries) |
| 7 | Срок годности | date |
| 8 | Текущий статус (active / used / disposed) | select |

## Структура

Не привычный journal-таблица, а **граф связей**:
- Корень: partia/batchKey (генерируется в incoming_control при приёмке)
- Ветви: использования + списания
- UI: timeline по batchKey

## Ритм

Auto-generated. Записи появляются автоматически когда:
- Принимается партия (incoming_control) → создаётся batchKey
- Готовится блюдо из партии (finished_product) → ссылка на batchKey
- Списывается часть партии (product_writeoff) → ссылка на batchKey

## TasksFlow flow

Не имеет TF-задач — это auto-aggregated journal. Менеджер только
просматривает на странице `/journals/traceability/<batchKey>`.

## Compliance rule

Compliance не падает (auto-generated). Дашборд показывает «N активных
партий с истекающим сроком < 3 дней».

## Sources

- ТР ТС 021/2011 ст. 8
- ХАССП — recall-механизм
