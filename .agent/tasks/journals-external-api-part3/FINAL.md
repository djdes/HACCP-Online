# Part-3 verification — final report

**Ran at:** 2026-04-15 (iteration after tariff shipping commit 07125f0)
**Target org (test):** `cmnm40ikt00002ktseet6fd5y`

## HTTP layer — 35 / 35 PASS

For every canonical journal code the script
`scripts/test-external-fill-v3.ts` issued a real POST with a realistic payload,
captured the exact `curl` command (`request.sh`, token masked), and the raw
response (`response.json`). Summary lives in `_summary/http-results.md` +
`_summary/http-results.json`. All 35 returned
`{"ok":true,"entriesWritten":1}`.

## Storage routing

The dispatcher splits into two paths by template code (see
`_summary/CONFIG_WRITER_CODES.md`):

| Path | Where data lands | Journal codes |
|---|---|---|
| **entry-writer** | `JournalDocumentEntry.data` | `hygiene`, `health_check`, `climate_control`, `cold_equipment_control`, `cleaning`, `cleaning_ventilation_checklist`, `equipment_cleaning`, `fryer_oil`, `general_cleaning`, `glass_control`, `incoming_control`, `incoming_raw_materials_control`, `med_books`, `pest_control`, `uv_lamp_runtime` (15) |
| **config-writer** | `JournalDocument.config` (JSONB patch/normalize) | `accident_journal`, `audit_plan`, `audit_protocol`, `audit_report`, `breakdown_history`, `complaint_register`, `disinfectant_usage`, `equipment_calibration`, `equipment_maintenance`, `finished_product`, `glass_items_list`, `intensive_cooling`, `metal_impurity`, `perishable_rejection`, `ppe_issuance`, `product_writeoff`, `sanitary_day_control`, `staff_training`, `traceability_test`, `training_plan` (20) |

For **config-writer** journals the payload must match the journal-specific row
shape defined in `src/lib/<code>-document.ts`; generic `{note: ...}` keys are
merged but then dropped by the normalizer. Integrators need to follow the
shape. HTTP response is still `ok:true, entriesWritten:1` regardless — that
reflects how many input rows were ingested into the merge step, not how
many UI-visible rows are present.

## Residue cleanup — 35 docs, 1 per code

Backup `.agent/backups/db-pre-part3-cleanup-07125f0.sql.gz`. One transaction
ranked documents inside the test org by entry count + config size + updatedAt
and deleted all but the top. Result: 56 extra docs removed, every template
now has **exactly one** `JournalDocument` in the test org.

Per-code residue counts (entries / config bytes):

| Code | entries | config bytes |
|---|---:|---:|
| hygiene | 122 | - |
| health_check | 122 | - |
| uv_lamp_runtime | 31 | - |
| cold_equipment_control | 9 | - |
| climate_control | 9 | - |
| cleaning_ventilation_checklist | 8 | - |
| equipment_cleaning | 8 | - |
| med_books | 8 | - |
| fryer_oil | 7 | - |
| glass_control | 7 | - |
| pest_control | 6 | - |
| cleaning | 5 | - |
| sanitary_day_control | 1 | 4741 |
| incoming_control | 0 | - |
| incoming_raw_materials_control | 0 | - |
| general_cleaning | 0 | - |
| audit_plan | 0 | 4922 |
| disinfectant_usage | 0 | 2745 |
| finished_product | 0 | 2562 |
| perishable_rejection | 0 | 1822 |
| equipment_maintenance | 0 | 1718 |
| traceability_test | 0 | 1708 |
| audit_report | 0 | 1588 |
| product_writeoff | 0 | 1498 |
| metal_impurity | 0 | 1403 |
| breakdown_history | 0 | 1399 |
| accident_journal | 0 | 1356 |
| intensive_cooling | 0 | 1332 |
| training_plan | 0 | 1250 |
| complaint_register | 0 | 1124 |
| equipment_calibration | 0 | 1111 |
| staff_training | 0 | 1079 |
| ppe_issuance | 0 | 1022 |
| audit_protocol | 0 | 982 |
| glass_items_list | 0 | 629 |

`incoming_control`, `incoming_raw_materials_control`, `general_cleaning` show
0/0 because their surviving doc had no entries yet and the payload
normalisation for those entry-writer codes dropped the v3 script's mock
values (shape mismatch vs the normaliser). Fixing these three is the
obvious next pickup.

## What is NOT verified here

- **UI rendering** — I did not run Playwright per journal. The evidence is
  HTTP + DB residue only. For a handful of journals (`hygiene`,
  `cold_equipment_control`, `cleaning`) I've visually confirmed in earlier
  sessions that UI renders what the API writes. The other 32 need a manual
  or scripted browser pass.
- **PDF rendering** — same. `/api/journal-documents/<id>/pdf` is
  session-gated and was not exercised with a browser session in this run.
- **Config-writer payload shape** — generic payloads succeeded at HTTP, but
  the UI will show whatever the normaliser accepted; in practice existing
  config rows from the previous agent's seeding are what the admin sees.

These gaps are the mandate for the next chat.

## Artefacts

- `scripts/test-external-fill-v3.ts`
- `.agent/tasks/journals-external-api-part3/<code>/request.sh`
- `.agent/tasks/journals-external-api-part3/<code>/response.json`
- `.agent/tasks/journals-external-api-part3/<code>/evidence.md`
- `.agent/tasks/journals-external-api-part3/_summary/http-results.{md,json}`
- `.agent/tasks/journals-external-api-part3/_summary/CONFIG_WRITER_CODES.md`
- `.agent/backups/db-pre-part3-cleanup-07125f0.sql.gz` (rollback)
