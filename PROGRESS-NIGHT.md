# Ночная работа 2026-05-02

Cron `*/5 * * * *`, job `d374f9b9`. Self-stop в 07:00 — после этого
итерации возвращают «Стоп» без работы.

## Цели ночи

- **Phase 1**: redesign forms (tooltips/validation/autofill)
- **Phase 2**: написать гайды для 22 missing journals — главный приоритет
- **Phase 3**: checklists/pipelines в Setup (большая фича)
- **Phase 4**: UI polish (анимации, hover, типографика)
- **Phase 5**: расширения по системе (если хватит времени)

## Карта журналов

**Готовые гайды (13):** hygiene, health_check, cold_equipment_control,
climate_control, cleaning, finished_product, incoming_control,
intensive_cooling, fryer_oil, disinfectant_usage, ppe_issuance,
staff_training, med_books

**Missing (22):**
- equipment_cleaning, perishable_rejection, complaint_register,
  accident_journal, pest_control
- uv_lamp_runtime, general_cleaning, cleaning_ventilation_checklist
- glass_control, glass_items_list, metal_impurity, traceability_test
- equipment_maintenance, equipment_calibration, breakdown_history
- product_writeoff, incoming_raw_materials_control, sanitary_day_control
- audit_plan, audit_protocol, audit_report
- training_plan

## Хронология

### Iteration 5 — 00:48 — Phase 4 анимации + Phase 1 live-валидация (commit 6331073c)
**Phase 4 — анимации:**
- TaskFillHelperModal: backdrop fade-in + slide-up + sm:zoom-in-95
- ConfirmSheet, NoEventsSheet — те же анимации
- Form-card: slide-up-from-bottom-4 fade-in (500ms)
- Поля формы: stagger по 60ms между каждым полем

**Phase 1 — live-валидация:**
- validateNumberField() сравнивает с min/max адаптера
- Под input показывается «В норме» (emerald) / «Выше/ниже нормы — нарушение» (rose)
- Border карточки меняет цвет на rose-300 / emerald-200 в зависимости от статуса
- Юзер видит ошибку до сабмита периферийным зрением

### Iteration 4 — 00:42 — guides batch 4 — ВСЕ 35 ПОКРЫТЫ ✅
- product_writeoff (бракераж/списание)
- incoming_raw_materials_control (входной контроль сырья)
- sanitary_day_control (санитарный день)
- audit_plan (план аудитов)
- audit_protocol (протокол аудита)
- audit_report (отчёт аудита)
- training_plan (план обучения)
- 28 → 35/35 ✅✅✅
- **Phase 2 полностью завершена**

### Iteration 3 — 00:36 — guides batch 3 (commit 4ac3cbdf)
- equipment_maintenance, equipment_calibration, breakdown_history
- metal_impurity, traceability_test
- 23 → 28/35

### Iteration 2 — 00:30 — guides batch 2
- uv_lamp_runtime (УФ-лампы)
- general_cleaning (генеральные уборки)
- cleaning_ventilation_checklist (вентиляция)
- glass_control (стеклоконтроль)
- glass_items_list (опись хрупких)
- 18 → 23/35 ✅
- Осталось 12 missing

### Iteration 1 — 00:24 — guides batch 1 (commit ee16f94b)
- equipment_cleaning (мойка оборудования) — был в скрине у юзера, теперь закрыт
- perishable_rejection (бракераж скоропорта)
- complaint_register (жалобы)
- accident_journal (аварии/ЧП)
- pest_control (ДДД)
- 13 → 18/35 ✅
- Осталось 17/22 missing
