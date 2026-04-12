# Evidence

## Snapshot

Task: `journals-full-parity-2026-04-11`

This refresh closes the local runtime proof gap for list/detail/print and replaces the fake all-blocked visual matrix with a canonical 35-row verdict set.

## Code changes in this loop

- [document-pdf.ts](/c:/www/Wesetup.ru/src/lib/document-pdf.ts) now has an explicit `disinfectant_usage` PDF branch and file prefix.
- [capture-local-runtime-proof.ts](/c:/www/Wesetup.ru/scripts/capture-local-runtime-proof.ts) now:
  - accepts non-empty rendered detail pages instead of only editable ones
  - auto-creates default documents through `/api/journal-documents` when a list page is empty
  - probes `/api/journal-documents/[id]/pdf` for runtime print proof
- [page.tsx](/c:/www/Wesetup.ru/src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx) had temporary debug `console.log` calls removed.

## Fresh checks

Fresh command outputs are stored under `.agent/tasks/journals-full-parity-2026-04-11/raw/`.

- `npx tsc --noEmit`
  - Result: `PASS`
- `npx eslint "scripts/capture-local-runtime-proof.ts" "src/lib/document-pdf.ts" "src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx"`
  - Result: `PASS` with warnings only
  - Warnings are pre-existing unused symbols outside this task's defect scope.
- `npx tsx scripts/capture-local-runtime-proof.ts`
  - Result: `PASS`
  - Artifacts:
    - `raw/local-runtime-sweep.json`
    - `raw/local-runtime-sweep.md`
  - Summary:
    - list routes: `35/35 PASS`
    - detail routes: `35/35 PASS`
    - print-expected journals: `35/35 PASS`
    - `med_books` remains correctly `no-print-expected`
    - `disinfectant_usage` PDF runtime failure is fixed

## Visual-proof state

- Canonical reviewed matrix:
  - `raw/reviewed-visual-matrix.md`
  - `raw/reviewed-visual-matrix.json`
- Totals:
  - `CLOSE`: `18`
  - `FIXED`: `2`
  - `BLOCKED`: `15`
- Supporting reviewed batches:
  - `raw/visual-batch-1-review.md`
  - `raw/visual-batch-2-review.md`

Current blocked visual set is isolated and explicit:

- `disinfectant_usage`
- `glass_control`
- `glass_items_list`
- `incoming_control`
- `incoming_raw_materials_control`
- `intensive_cooling`
- `perishable_rejection`
- `pest_control`
- `ppe_issuance`
- `product_writeoff`
- `sanitary_day_control`
- `staff_training`
- `traceability_test`
- `training_plan`
- `uv_lamp_runtime`

These are not runtime failures anymore. They are proof gaps: live/detail/docprint and local runtime evidence exist, but the bundle still lacks a row-by-row visual comparison note for each of them.

## Current acceptance-criterion snapshot

- `AC1`: `PASS`
  - `inventory.md` still tracks the 35-journal target set.
- `AC2`: `PASS`
  - `inventory.md` and `raw/implementation-matrix.json` still map all 35 journals to route/list/detail implementations.
- `AC3`: `PASS`
  - `raw/visual-matrix.json` and [source-journal-map.ts](/c:/www/Wesetup.ru/src/lib/source-journal-map.ts) still cover the live/source mapping set.
- `AC4`: `PARTIAL`
  - A canonical 35-row visual verdict matrix now exists.
  - `15` journals remain explicitly `BLOCKED` because row-by-row visual comparison notes are still missing.
- `AC5`: `PARTIAL`
  - Visual outcomes are now explicit as `CLOSE`, `FIXED`, or `BLOCKED`.
  - The blocked set is isolated, but not yet reduced to zero.
- `AC6`: `PASS`
  - Local runtime proof now covers list/detail routing for all `35/35` journals.
  - The shared disappearing-document fix remains in place and local DB-backed proof now exists through the real app path.
- `AC7`: `PARTIAL`
  - Open/list/create/print runtime behavior is now proven through the local app path.
  - Full end-to-end runtime proof for every edit/save/delete/archive action is still not packaged journal by journal.
- `AC8`: `PASS`
  - `raw/local-runtime-sweep.*` now proves correct runtime PDF behavior for every print-expected journal.
  - `med_books` remains correctly `no-print-expected`.
- `AC9`: `PASS`
  - The discovered print/runtime defect class was rechecked across the full 35-journal set.
- `AC10`: `PASS`
  - Required proof-loop artifacts remain present.
- `AC11`: `PASS`
  - Fresh TypeScript, focused ESLint, and runtime sweep artifacts were rerun on current repo state.
- `AC12`: `FAIL`
  - Completion is still blocked by the remaining visual-proof blockers and by incomplete packaged runtime proof for the full edit/save/delete/archive surface.

## Residual blockers

- `15` journals still lack row-by-row visual comparison notes in the canonical matrix.
- Full packaged runtime proof for every edit/save/delete/archive interaction is still incomplete, even though list/detail/create/print is now covered across all 35.
