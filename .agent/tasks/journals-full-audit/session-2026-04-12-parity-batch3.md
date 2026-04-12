# Visual parity batch 3 — 2026-04-12 (prod sha ad72f7a)

| # | Journal | Route | AC1 | Notes |
|---|---|---|---|---|
| 11 | Журнал бракеража скоропортящейся пищевой продукции | `/journals/perishable_rejection` | ✅ PASS | Card rows + Дата начала column match ref |
| 12 | Журнал входного контроля сырья, ингредиентов, упаковочных материалов | `/journals/incoming_raw_materials_control` | ✅ PASS | Ответственный + Дата начала match ref (181) |
| 13 | Журнал контроля изделий из стекла и хрупкого пластика | `/journals/glass_control` | ✅ PASS | Ответственный + Дата начала |
| 14 | Журнал контроля интенсивного охлаждения горячих блюд | `/journals/intensive_cooling` | ✅ PASS | Card + Дата начала |
| 15 | Журнал прослеживаемости продукции | `/journals/traceability_test` | ✅ PASS | Card + Дата начала; no "Инструкция" button (consistent with ref) |

Accumulated status: **15/34 journals** AC1 audited. 14 PASS, 1 MINOR (equipment_cleaning header wrap).

Remaining (19): complaint, staff_training, cleaning (list), accident, ppe_issuance, fryer_oil, metal_impurity, uv_lamp_runtime, breakdown_history, med_books, audit_report, glass_list, training_plan (list already done indirectly), audit_plan, audit_protocol, cleaning_ventilation_checklist, sanitation_day, cold_equipment (done indirectly), climate (done). Some of these have been navigated as part of earlier tests (cold_equipment, cleaning doc, training_plan doc).
