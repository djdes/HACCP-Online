# Evidence

## Snapshot

Task: `journals-full-parity-2026-04-11`

This is the current proof-loop snapshot after the latest print/PDF normalization batch. It is not a completion claim.

## Systemic fixes proven in code

- Routing/wiring:
  - Added missing list-page dispatch in [page.tsx](/abs/path/c:/www/Wesetup.ru/src/app/(dashboard)/journals/[code]/page.tsx) for `complaint_register`, `audit_protocol`, and `audit_report`.
- Mapping:
  - Added the missing live/source alias `sanitation1journal -> cleaning_ventilation_checklist` in [source-journal-map.ts](/abs/path/c:/www/Wesetup.ru/src/lib/source-journal-map.ts).
- Print/PDF normalization:
  - List-page print now uses the shared helper in:
    - [audit-plan-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/audit-plan-documents-client.tsx)
    - [audit-protocol-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/audit-protocol-documents-client.tsx)
    - [audit-report-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/audit-report-documents-client.tsx)
    - [metal-impurity-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/metal-impurity-documents-client.tsx)
    - [hygiene-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/hygiene-documents-client.tsx)
    - [equipment-maintenance-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/equipment-maintenance-documents-client.tsx)
    - [equipment-calibration-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/equipment-calibration-documents-client.tsx)
    - [staff-training-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/staff-training-documents-client.tsx)
    - [pest-control-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/pest-control-documents-client.tsx)
  - [document-pdf.ts](/abs/path/c:/www/Wesetup.ru/src/lib/document-pdf.ts) now has explicit PDF generation branches for:
    - `audit_plan`
    - `audit_protocol`
    - `audit_report`
    - `metal_impurity`
    - `hygiene`
  - Removed dead detail-side legacy `?print=1 -> window.print()` handlers from:
    - [audit-plan-document-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/audit-plan-document-client.tsx)
    - [audit-protocol-document-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/audit-protocol-document-client.tsx)
    - [audit-report-document-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/audit-report-document-client.tsx)
    - [cleaning-document-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/cleaning-document-client.tsx)
    - [metal-impurity-document-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/metal-impurity-document-client.tsx)
  - Unsupported template codes still fail explicitly instead of silently returning a wrong hygiene PDF.
- Error handling:
  - [open-document-pdf.ts](/abs/path/c:/www/Wesetup.ru/src/lib/open-document-pdf.ts) provides readable Russian error handling for blocked popup / invalid PDF responses.
  - [route.ts](/abs/path/c:/www/Wesetup.ru/src/app/api/journal-documents/[id]/pdf/route.ts) now returns readable HTML for direct browser-open failures and JSON for fetch-based callers.
- Med books parity:
  - Removed unsupported print actions from:
    - [med-book-documents-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/med-book-documents-client.tsx)
    - [med-book-document-client.tsx](/abs/path/c:/www/Wesetup.ru/src/components/journals/med-book-document-client.tsx)
  - This aligns local `med_books` behavior with both the local screenshot references and the live `medbook` surfaces, where print is not exposed.
- Mutation hardening:
  - Previously completed response-gating fixes remain in equipment/staff/pest/hygiene clients and are still part of the current proof base.

## Fresh checks

Fresh command outputs are stored under `.agent/tasks/journals-full-parity-2026-04-11/raw/`.

- `npx tsc --noEmit`
  - Result: `PASS`
  - Artifacts:
    - `raw/build.txt`
    - `raw/build-latest.txt`
- Targeted `eslint` on the latest print/PDF batch
  - Result: `PASS with warnings only`
  - Errors: `0`
  - Warnings: `6`
  - Artifacts:
    - `raw/lint.txt`
    - `raw/eslint-3.txt`
    - `raw/eslint-latest.txt`
- Proof-loop schema support files
  - Artifacts:
    - `raw/test-unit.txt`
    - `raw/test-integration.txt`
    - `raw/screenshot-1.png`
- Per-journal print scan
  - Artifacts:
    - `raw/print-matrix.json`
    - `raw/print-matrix.md`
    - `raw/print-scan-2.txt`
- Per-journal behavior/button proof
  - Artifacts:
    - `raw/behavior-matrix.json`
    - `raw/behavior-matrix.md`
    - `raw/behavior-proof-notes.md`
- Existing inventory/mapping/visual artifacts retained:
  - `inventory.md`
  - `raw/implementation-matrix.json`
  - `raw/visual-matrix.json`
  - `raw/visual-matrix.md`
  - `raw/reviewed-visual-matrix.json`
  - `raw/reviewed-visual-matrix.md`
  - `raw/live-proof-matrix.json`
  - `raw/live-proof-matrix.md`
  - `raw/visual-review-ledger.json`
  - `raw/visual-review-ledger.md`
  - `raw/visual-batch-1-review.json`
  - `raw/visual-batch-1-review.md`
  - `raw/visual-batch-2-review.json`
  - `raw/visual-batch-2-review.md`
  - `raw/db-runtime-check.json`

## Current acceptance-criterion snapshot

- `AC1`: `PASS`
  - `inventory.md` tracks the 35-journal target set.
- `AC2`: `PASS`
  - Each active journal is mapped to route, list implementation, detail implementation, print mode, and crawl folder in `inventory.md` and `raw/implementation-matrix.json`.
- `AC3`: `PASS`
  - Live/source mapping is documented for the active 35, including the fixed `sanitation1journal` alias.
- `AC4`: `FAIL`
  - `raw/reviewed-visual-matrix.*` proves that all 35 journals have local references plus live active/archive bundle inputs.
  - `raw/live-proof-matrix.*` adds fresh live detail captures for all 35 journals.
  - `raw/visual-review-ledger.*` now consolidates local refs plus live list/archive/detail/print inputs journal by journal into one review ledger.
  - `raw/visual-batch-1-review.*` adds completed reviewed notes for the first six high-priority journals: `audit_plan`, `audit_protocol`, `audit_report`, `cleaning`, `metal_impurity`, `med_books`.
  - `raw/visual-batch-2-review.*` adds completed reviewed notes for six more journals: `hygiene`, `health_check`, `climate_control`, `cold_equipment_control`, `equipment_maintenance`, `equipment_calibration`.
  - The remaining gap is the actual reviewed verdict per journal: the bundle still does not record completed visual comparison outcomes against the local screenshot references.
- `AC5`: `FAIL`
  - Visual parity proof is stronger now because `raw/live-proof-matrix.*` confirms live detail captures for 35/35 journals and live print PDF captures for every print-expected journal.
  - `raw/visual-review-ledger.*` removes the file-discovery mess and gives one bounded artifact per journal for future reviewed verdicts.
  - `raw/visual-batch-1-review.*` confirms a `CLOSE` visual verdict for five recently touched journals and a `FIXED` verdict for `med_books` after removing the unsupported print action.
  - `raw/visual-batch-2-review.*` confirms another six `CLOSE` visual verdicts without new defects.
  - The remaining gap is explicit reviewed comparison outcomes journal by journal; proof depth improved, but the bundle still does not show a completed visual verdict matrix.
- `AC6`: `UNKNOWN`
  - `raw/behavior-matrix.json` covers create/open/edit/save/delete/archive-close flow flags across all 35 journals.
  - `raw/behavior-proof-notes.md` captures bounded batch A/B/C code-review confirmation for the main interaction and routing surfaces.
  - `raw/db-runtime-check.json` records the current local blocker: Prisma cannot reach PostgreSQL, so stronger DB/data-flow proof could not be rerun on this machine.
- `AC7`: `UNKNOWN`
  - `raw/behavior-matrix.*` plus `raw/print-matrix.*` provide cross-journal button wiring coverage.
  - `raw/db-runtime-check.json` records the current local blocker that prevents stronger cross-journal runtime button verification.
- `AC8`: `UNKNOWN`
  - `raw/print-matrix.md` no longer shows `RISK` rows after the dead detail-side legacy print handlers were removed.
  - `raw/live-proof-matrix.*` now adds fresh live print evidence for every print-expected journal; `med_books` is correctly classified as `no-print-expected` based on local references and live `medbook` surfaces.
  - The remaining gap is proof scope, not active code-level divergence: the current bundle still does not include application-runtime PDF-open evidence for every local print-capable journal.
  - `raw/db-runtime-check.json` records the current local blocker for route-level PDF verification through the local application runtime.
- `AC9`: `PASS`
  - The systemic routing, alias, response-handling, and print defect classes were rechecked across the active 35 through `inventory.md`, `raw/behavior-matrix.*`, `raw/print-matrix.*`, and `raw/defect-propagation.md`.
  - The remaining non-pass criteria are proof-depth gaps for visual review and runtime PDF verification, not unpropagated defect classes.
- `AC10`: `PASS`
  - Required proof-loop artifacts now exist in task scope, including schema-required raw placeholders and current evidence/verdict artifacts.
- `AC11`: `PASS`
  - Fresh static verification was rerun after the latest code changes.
- `AC12`: `FAIL`
  - Completion cannot be claimed because AC4 and AC5 are currently `FAIL`, and AC6, AC7, and AC8 remain partially unproven.

## Residual risks

- The biggest remaining gaps are proof-oriented: reviewed visual verdicts, local runtime interaction proof, and local runtime PDF-open evidence.
- Visual input readiness is documented for all 35 journals in `raw/reviewed-visual-matrix.*`, and live detail/print capture depth is now materially stronger in `raw/live-proof-matrix.*`, but actual reviewed verdicts are still missing.
- The current evidence bundle is materially stronger than the prior snapshot, but it still falls short of full 35-journal completion.
