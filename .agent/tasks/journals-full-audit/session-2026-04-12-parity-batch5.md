# Visual parity batch 5 — 2026-04-12 (prod sha 4482f4e)

| # | Journal | Route | AC1 |
|---|---|---|---|
| 21 | Журнал учета металлопримесей | `/journals/metal_impurity` | ✅ PASS |
| 22 | Журнал учета работы УФ бактерицидной установки | `/journals/uv_lamp_runtime` | ✅ PASS |
| 23 | Карточка истории поломок | `/journals/breakdown_history` | ✅ PASS |
| 24 | Медицинские книжки | `/journals/med_books` | ✅ PASS |
| 25 | Отчет о внутреннем аудите | `/journals/audit_report` | ✅ PASS (empty-state "Документов пока нет") |

Accumulated: **25/34 journals** list-view AC1 audited (24 PASS, 1 MINOR).

Remaining (9): glass_list, training_plan, audit_plan, audit_protocol,
cleaning_ventilation_checklist, general_cleaning (sanitation_day), cleaning
(list), cold_equipment (list already PASS indirectly), climate (list already PASS).

Hygiene skipped (gold reference).
