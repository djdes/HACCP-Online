# Task Spec: journals-full-parity-2026-04-11

## Goal
Bring the journal system to current full parity across the 35 active journal templates by auditing, fixing, and re-verifying routing, implementation mapping, print/PDF behavior, data flows, interactions, and visual parity against the repository reference assets and live-site crawl artifacts.

## Current facts
- `prisma/seed.ts` defines **35 active journal templates** in `ACTIVE_JOURNAL_TEMPLATES`.
- The previous spec is stale because it assumed 33 active journals plus 2 missing journals.
- Local reference assets live in `journals/`.
- Live-site mapping and comparison artifacts live in `tmp-source-journals/`, especially `full-crawl/` and `live-journal-access-check.json`.
- Journal route dispatch is centered in `src/app/(dashboard)/journals/[code]/page.tsx`.
- Journal document detail routing is centered in `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx`.
- Source/live slug mapping is centralized in `src/lib/source-journal-map.ts`.
- PDF generation is centralized in `src/lib/document-pdf.ts`.
- Known current risks:
  - `complaint_register`, `audit_protocol`, and `audit_report` had list-page wiring risk even though related clients and detail flows exist.
  - Print behavior is split between direct PDF API routes and legacy `?print=1` HTML print pages.
  - `sanitation1journal -> cleaning_ventilation_checklist` is missing from the central alias mapping.
  - `document-pdf.ts` contains a dangerous fallback path that can return a hygiene PDF for unsupported templates instead of failing explicitly.

## Scope
- Audit all 35 active journals end to end.
- Fix systemic defects first, then journal-specific defects.
- Keep diffs minimal and favor shared fixes when the same defect pattern affects multiple journals.
- Preserve unrelated user changes in the worktree.

## Non-goals
- Do not rewrite the entire journal framework if targeted fixes achieve parity.
- Do not invent new journal behavior beyond what is supported by the current architecture, local references, and live-site artifacts.
- Do not claim pixel-perfect parity where source artifacts are insufficient; document those cases instead.

## Acceptance criteria

### AC1. Full journal inventory exists
A durable inventory artifact lists all 35 journal folders and all 35 active templates, with per-journal status and mapping.

### AC2. Each journal is mapped to local implementation
Each journal folder is mapped to its local journal code, route, list implementation, and detail implementation, with partial or missing wiring explicitly flagged.

### AC3. Each journal is mapped to a live counterpart
Each active journal is mapped to its live-site slug or counterpart using the crawl/access artifacts, including any alias handling required for correct matching.

### AC4. Visual parity is checked for every journal
Each journal is checked against screenshots and/or live captures for list pages, detail pages, visible controls, labels, and print affordances.

### AC5. Visual parity is improved where feasible
Material visual mismatches are fixed where supported by available artifacts; any unresolved gaps are explicitly documented with a concrete blocker.

### AC6. Data flow and behavior are verified
For each applicable journal, routing, loading, saving, editing, archive behavior, document/entry persistence, and DB-backed flows are checked and fixed where broken.

### AC7. Critical buttons and interactions work
All critical journal actions, including create, open, edit, delete/archive where applicable, and print actions, open the expected routes and perform the expected behavior.

### AC8. Print behavior is correct for every journal
For every journal where print is expected:
- Print exists where expected.
- Print opens the correct route.
- The route yields the correct journal PDF table.
- Print does not open a blank page.
- Print does not silently fail.
- List-page and detail-page print behavior do not diverge for the same journal.

### AC9. Defect classes are propagated across all journals
Every discovered defect class is re-checked across the full journal set, and systemic fixes are applied where safe and appropriate.

### AC10. Proof-loop artifacts are complete
The task contains `spec.md`, `evidence.md`, `evidence.json`, raw supporting artifacts, and `problems.md` if any verification pass initially fails.

### AC11. Final verification is fresh
A fresh verification pass is run against the current repository state after fixes, not against prior claims or stale outputs.

### AC12. Completion is gated by PASS or isolated blockers
Completion is allowed only when every acceptance criterion is `PASS`, or any remaining blocker is explicitly documented, isolated, and shown not to prevent completion of the rest of the journal set.

## Implementation requirements
- Rebuild the inventory/evidence matrix with at least:
  `folder | code | sourceSlug | route | list-page wired? | detail wired? | print mode | live mapped? | status`
- Treat `complaint_register`, `audit_protocol`, and `audit_report` as partial wiring risks until route dispatch is verified.
- Add the missing alias `sanitation1journal -> cleaning_ventilation_checklist` in the central source/live mapping.
- Normalize print behavior toward the PDF API path as the primary print path.
- Before switching any legacy `?print=1` journal to the PDF API, add explicit PDF generator support for that journal if missing.
- Remove the silent hygiene-PDF fallback for unsupported template codes; unsupported PDF generation must fail explicitly and observably.
- Re-check all journals for analogous print defects after any print fix.
- Re-check all journals for analogous wiring defects after any wiring fix.

## Verification plan
- Build and validate the 35/35/35 inventory: local folders, active templates, and live mappings.
- Verify route coverage for all 35 `/journals/[code]` pages.
- Verify list/detail implementation coverage for all 35 journals.
- Verify print behavior for every applicable journal, including route correctness and non-blank PDF output.
- Run fresh static checks on touched code, including `npx tsc --noEmit` and targeted linting.
- Record per-journal findings, fixes, remaining blockers, and final acceptance-criterion verdicts in proof-loop artifacts.

## Assumptions
- The existing task id remains `.agent/tasks/journals-full-parity-2026-04-11/`.
- The active target set is the 35 templates in `prisma/seed.ts`.
- The three journals with suspected list-page gaps are considered partially implemented until verified otherwise, not missing.
- Live crawl artifacts and local screenshot folders are sufficient for autonomous comparison work.
- If a specific visual parity issue cannot be resolved because source material is insufficient, it must be documented as an isolated blocker rather than guessed.
