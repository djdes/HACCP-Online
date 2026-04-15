# Config-writer vs entry-writer journals

The external API dispatches writes into one of two storage paths depending on the template:

- **Entry-writer** (data lands in `JournalDocumentEntry.data`):
  accident-free payload shape, one row per (employeeId, date).
  Codes: `hygiene`, `health_check`, `climate_control`, `cold_equipment_control`,
  `cleaning`, `cleaning_ventilation_checklist`, `cold_equipment_control`,
  `equipment_cleaning`, `fryer_oil`, `general_cleaning`, `glass_control`,
  `incoming_control`, `incoming_raw_materials_control`, `med_books`,
  `pest_control`, `uv_lamp_runtime`.

- **Config-writer** (data merged into `JournalDocument.config`; `JournalDocumentEntry`
  table is NOT touched for these codes):
  payload must match the journal-specific row shape (e.g. for `accident_journal`
  it is `{rows: [{id, accidentDate, accidentHour, locationName, ...}]}`).
  Codes: `accident_journal`, `audit_plan`, `audit_protocol`, `audit_report`,
  `breakdown_history`, `complaint_register`, `disinfectant_usage`,
  `equipment_calibration`, `equipment_maintenance`, `finished_product`,
  `glass_items_list`, `intensive_cooling`, `metal_impurity`,
  `perishable_rejection`, `ppe_issuance`, `product_writeoff`,
  `sanitary_day_control`, `staff_training`, `traceability_test`,
  `training_plan`.

## Consequence for external integrators

A generic `{note: "x"}` payload for a config-writer journal returns
HTTP 200 but contributes nothing that the UI or PDF will render —
the normalizer drops unknown keys. To fill a config-writer journal
you must send the normalized row shape. See
`src/lib/<code>-document.ts` for the canonical type.
