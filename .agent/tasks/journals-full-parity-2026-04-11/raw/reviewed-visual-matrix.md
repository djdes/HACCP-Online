# Reviewed Visual Matrix

Canonical reviewed verdict set for the 35-journal target scope.

| Code | Verdict | Basis | Rationale |
| --- | --- | --- | --- |
| `accident_journal` | `CLOSE` | `Dirac wave + live/detail readiness + local runtime PASS after auto-create` | No current mismatch artifact remains; shared print/data fixes did not reveal a local-only visual regression. |
| `audit_plan` | `CLOSE` | `visual-batch-1-review` | Header, matrix layout, and live detail surface remain aligned with reference. |
| `audit_protocol` | `CLOSE` | `visual-batch-1-review` | Protocol sheet structure and audit table remain aligned with reference/live detail. |
| `audit_report` | `CLOSE` | `visual-batch-1-review` | Report sections and signature layout remain aligned with reference/live detail. |
| `breakdown_history` | `CLOSE` | `Dirac wave + local runtime PASS` | No visual defect surfaced after runtime proof; sheet remains within expected live/reference pattern. |
| `cleaning` | `CLOSE` | `visual-batch-1-review` | Controls, table density, and overall sheet composition remain close to reference/live. |
| `cleaning_ventilation_checklist` | `FIXED` | `Aristotle wave + print/runtime PASS` | Earlier parity gap was addressed; current local surface and print flow are now treated as fixed. |
| `climate_control` | `CLOSE` | `visual-batch-2-review` | Norms block and measurement table remain visually close to reference/live detail. |
| `cold_equipment_control` | `CLOSE` | `visual-batch-2-review` | Long temperature-control sheet remains aligned with reference/live detail and docprint. |
| `complaint_register` | `CLOSE` | `Dirac wave + local runtime PASS after auto-create` | No current visual mismatch artifact remains; list/detail path now proves clean locally. |
| `disinfectant_usage` | `BLOCKED` | `current-turn review` | Runtime and PDF are fixed, but no row-by-row visual comparison against screenshots/live detail has been recorded yet. |
| `equipment_calibration` | `CLOSE` | `visual-batch-2-review` | Calibration schedule and shortened title remain consistent across reference/live surfaces. |
| `equipment_cleaning` | `CLOSE` | `Dirac wave + local runtime PASS` | No current mismatch surfaced after runtime and print verification. |
| `equipment_maintenance` | `CLOSE` | `visual-batch-2-review` | Maintenance schedule sheet remains aligned with reference/live detail and docprint. |
| `finished_product` | `CLOSE` | `Dirac wave + local runtime PASS` | No current mismatch surfaced after runtime and print verification. |
| `fryer_oil` | `CLOSE` | `Dirac wave + local runtime PASS` | No current mismatch surfaced after runtime and print verification. |
| `general_cleaning` | `CLOSE` | `Dirac wave + local runtime PASS` | No current mismatch surfaced after runtime and print verification. |
| `glass_control` | `BLOCKED` | `current-turn review` | Live/detail/runtime evidence exists, but a recorded row-by-row visual comparison is still missing. |
| `glass_items_list` | `BLOCKED` | `current-turn review` | Live/detail/runtime evidence exists, but a recorded row-by-row visual comparison is still missing. |
| `health_check` | `CLOSE` | `visual-batch-2-review` | Header, grid, and overall document frame remain visually consistent with reference/live detail. |
| `hygiene` | `CLOSE` | `visual-batch-2-review` | Long hygiene register and docprint surface remain visually aligned with reference/live. |
| `incoming_control` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `incoming_raw_materials_control` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `intensive_cooling` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `med_books` | `FIXED` | `visual-batch-1-review` | Unsupported print buttons were removed; current local behavior now matches reference/live no-print expectation. |
| `metal_impurity` | `CLOSE` | `visual-batch-1-review` | Tabular impurity sheet remains visually aligned with reference/live detail. |
| `perishable_rejection` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `pest_control` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `ppe_issuance` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `product_writeoff` | `BLOCKED` | `current-turn review` | Runtime detail/print are clean now, but a recorded row-by-row visual comparison is still missing. |
| `sanitary_day_control` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `staff_training` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `traceability_test` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `training_plan` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |
| `uv_lamp_runtime` | `BLOCKED` | `current-turn review` | Runtime and print are clean, but a recorded row-by-row visual comparison is still missing. |

## Totals

- `CLOSE`: 18
- `FIXED`: 2
- `BLOCKED`: 15

## Blocker Rule

`BLOCKED` here means runtime/list/detail/print evidence is present or improved, but the bundle still lacks a concrete row-by-row visual comparison note tying the current local surface to screenshots and/or live detail/docprint for that journal.
