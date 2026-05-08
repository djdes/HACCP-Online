# Journal Specs Index

**Цель:** канонические специфики каждого журнала на платформе WeSetup.
Эти доки — источник правды для реализации, аудита, и онбординга
новых разработчиков. WeSetup — должен быть **эталоном** ХАССП-журналов
в РФ для рынка общепит/производство.

См. также:
- [00-reference-haccp-journals.md](../00-reference-haccp-journals.md) — обзор всех журналов с СанПиН-привязкой
- [_TEMPLATE.md](_TEMPLATE.md) — шаблон для новых spec'ов

## Tier A — обязательные по СанПиН для всех общепит

| Code | Назначение | Spec |
|------|------------|------|
| `hygiene` | Гигиенический журнал | [hygiene.md](hygiene.md) |
| `cold_equipment_control` | Температура холодильников | [cold_equipment_control.md](cold_equipment_control.md) |
| `climate_control` | Температура и влажность складов | [climate_control.md](climate_control.md) |
| `fryer_oil` | Учёт фритюрных жиров | [fryer_oil.md](fryer_oil.md) |

## Tier B — обязательные для соц.учр. (школы, сады, больницы, санатории)

| Code | Назначение | Spec |
|------|------------|------|
| `finished_product` | Бракераж готовой продукции | [finished_product.md](finished_product.md) |
| `perishable_rejection` | Бракераж скоропортящейся | [perishable_rejection.md](perishable_rejection.md) |

## Tier C — рекомендуемые ХАССП

### Уборка / гигиена

| Code | Назначение | Spec |
|------|------------|------|
| `cleaning` | Журнал уборки (matrix) | [cleaning.md](cleaning.md) |
| `general_cleaning` | График генеральных уборок | [general_cleaning.md](general_cleaning.md) |
| `cleaning_ventilation_checklist` | Чек-лист уборки и проветривания | [cleaning_ventilation_checklist.md](cleaning_ventilation_checklist.md) |
| `sanitary_day_control` | Памятка санитарного дня | [sanitary_day_control.md](sanitary_day_control.md) |
| `equipment_cleaning` | Мойка и дезинфекция оборудования | [equipment_cleaning.md](equipment_cleaning.md) |
| `disinfectant_usage` | Учёт дезинфицирующих средств | [disinfectant_usage.md](disinfectant_usage.md) |
| `pest_control` | ДДД (дезинсекция/дератизация) | [pest_control.md](pest_control.md) |
| `uv_lamp_runtime` | УФ-лампа | [uv_lamp_runtime.md](uv_lamp_runtime.md) |

### Персонал

| Code | Назначение | Spec |
|------|------------|------|
| `health_check` | Журнал здоровья | [health_check.md](health_check.md) |
| `med_books` | Медицинские книжки | [med_books.md](med_books.md) |
| `staff_training` | Регистрация инструктажей | [staff_training.md](staff_training.md) |
| `training_plan` | План обучения | [training_plan.md](training_plan.md) |
| `ppe_issuance` | Учёт выдачи СИЗ | [ppe_issuance.md](ppe_issuance.md) |

### Оборудование

| Code | Назначение | Spec |
|------|------------|------|
| `equipment_maintenance` | ППР (плановое обслуживание) | [equipment_maintenance.md](equipment_maintenance.md) |
| `equipment_calibration` | Поверка средств измерений | [equipment_calibration.md](equipment_calibration.md) |
| `breakdown_history` | Карточка истории поломок | [breakdown_history.md](breakdown_history.md) |

### Производство и качество

| Code | Назначение | Spec |
|------|------------|------|
| `incoming_control` | Входной контроль (базовый) | [incoming_control.md](incoming_control.md) |
| `incoming_raw_materials_control` | Входной контроль (расширенный для производств) | [incoming_raw_materials_control.md](incoming_raw_materials_control.md) |
| `intensive_cooling` | Интенсивное охлаждение горячих блюд | [intensive_cooling.md](intensive_cooling.md) |
| `metal_impurity` | Металлопримеси (мукопросеиватель) | [metal_impurity.md](metal_impurity.md) |
| `glass_items_list` + `glass_control` | Стекло и хрупкий пластик | [glass_control.md](glass_control.md) |
| `traceability_test` | Прослеживаемость (auto-aggregate) | [traceability_test.md](traceability_test.md) |

### Журналы происшествий и контроля

| Code | Назначение | Spec |
|------|------------|------|
| `complaint_register` | Регистрация жалоб | [complaint_register.md](complaint_register.md) |
| `accident_journal` | Учёт аварий | [accident_journal.md](accident_journal.md) |
| `product_writeoff` | Акт забраковки / списания | [product_writeoff.md](product_writeoff.md) |

### Аудит

| Code | Назначение | Spec |
|------|------------|------|
| `audit_plan` | План-программа внутренних аудитов | [audit_plan.md](audit_plan.md) |
| `audit_protocol` | Протокол внутреннего аудита | [audit_protocol.md](audit_protocol.md) |
| `audit_report` | Отчёт о внутреннем аудите | [audit_report.md](audit_report.md) |

## Workflow

1. Spec пишется до реализации.
2. Юзер (владелец продукта) проверяет соответствие реальности рынка.
3. Утверждённый spec ↔ реализация в коде.
4. Изменения в коде → обновление spec'а ОБЯЗАТЕЛЬНО.
5. Расхождение spec ↔ код = баг (либо то, либо другое).

## Status

Все spec'и — **draft**. Юзер должен проверить и пометить `approved`
перед фиксацией реализации. Гипербарометр в [00-reference-haccp-journals.md](../00-reference-haccp-journals.md)
обновляется по мере утверждения.
