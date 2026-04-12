# Behavior Proof Notes

## Batch A

- `accident_journal`, `breakdown_history`, `climate_control`, `cold_equipment_control`, `complaint_register`, `disinfectant_usage`, `equipment_cleaning`, `finished_product`, `fryer_oil`, `general_cleaning`, `glass_control`, `glass_items_list`
- Code review confirmed explicit create/open/edit/save/delete flows for each journal.
- Journals with explicit archive or close flow in code: `accident_journal`, `breakdown_history`, `complaint_register`, `disinfectant_usage`, `equipment_cleaning`, `fryer_oil`, `general_cleaning`, `glass_control`, `glass_items_list`.
- Journals without an explicit archive/close UI in the reviewed code were treated as design variants, not as button failures: `climate_control`, `cold_equipment_control`, `finished_product`.

## Batch B

- `health_check`, `hygiene`, `incoming_control`, `incoming_raw_materials_control`, `intensive_cooling`, `med_books`, `perishable_rejection`, `pest_control`, `ppe_issuance`, `product_writeoff`, `sanitary_day_control`, `staff_training`
- Code review confirmed route wiring plus create/open/edit/save/delete flows across the batch.
- Explicit close/archive/reopen coverage was confirmed for `incoming_control`, `incoming_raw_materials_control`, `intensive_cooling`, `med_books`, `pest_control`, `ppe_issuance`, `sanitary_day_control`, `staff_training`.
- `health_check`, `hygiene`, `perishable_rejection`, `product_writeoff` do not have the same explicit close/archive UX in the reviewed code, but the primary create/open/edit/save/delete interactions are present.

## Batch C

- `audit_plan`, `audit_protocol`, `audit_report`, `cleaning`, `cleaning_ventilation_checklist`, `equipment_calibration`, `equipment_maintenance`, `metal_impurity`, `traceability_test`, `training_plan`, `uv_lamp_runtime`
- `raw/behavior-matrix.json` marks `buttonProofStatus: CHECK` for the full batch and all rows have create/open/edit/save/delete flow flags set to `true`.
- Explicit archive/close proof is present for `audit_plan`, `cleaning`, `equipment_calibration`, `metal_impurity`, `traceability_test`, `training_plan`, `uv_lamp_runtime`.
- The full-crawl snapshot for each batch C journal contains a stable structural proof set: `2 html + 2 png + 3 json`, with list-page evidence of both a `docprint` link and an archive route.

## Cross-batch conclusions

- `raw/behavior-matrix.json` and `raw/behavior-matrix.md` cover all 35 active journals.
- The bounded batch reviews confirm that the matrix is not just a blind symbol table: the main interaction paths were checked in code for all journals.
- Remaining proof gaps are now visual-review depth and runtime PDF success, not the presence of core create/open/edit/save/delete routes.
