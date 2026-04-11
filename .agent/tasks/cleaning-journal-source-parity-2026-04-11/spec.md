# Task Spec: cleaning-journal-source-parity-2026-04-11

## Metadata
- Task ID: cleaning-journal-source-parity-2026-04-11
- Created: 2026-04-11
- Repo root: C:\www\Wesetup.ru

## Guidance sources
- AGENTS.md
- CLAUDE.md
- docs/superpowers/plans/2026-04-09-disinfectant-journal.md
- src/lib/cleaning-document.ts
- src/components/journals/cleaning-document-client.tsx
- src/app/(dashboard)/journals/[code]/page.tsx
- src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx
- User-provided screenshots in the task thread

## Original task statement
Copy the design and functionality of the attached journal screenshots for the cleaning journal, determine the structure/data logic from the screenshots, implement it by analogy with existing project journals, seed it with DB-backed test data, verify it against the original task, then push and trigger autodeploy.

## Current repo findings
- The target journal already exists under template code `cleaning`, but the current UX and config model do not match the screenshots.
- The screenshots show a custom document-based cleaning journal with:
  - a card-style documents list with active/closed tabs
  - create/settings/delete actions at the list level
  - document settings with separate responsible roles/employees for cleaning and control
  - a monthly matrix by room and day, including dedicated rows for responsible persons
  - add-room and add-responsible dialogs
  - auto-fill toggle and skip-weekends behavior
  - a lower reference table describing current vs general cleaning scope by room
- The current repo has no dedicated `cleaning` list client; `cleaning` is still routed through the generic tracked documents list.

## Acceptance criteria
- AC1: The journals list page for `cleaning` is replaced with a dedicated custom list page matching the screenshots: title, active/closed tabs, instruction button, create button, card layout, card metadata for responsible cleaning person(s), responsible control person, period, and overflow menu.
- AC2: The list page supports the screenshot flows for active documents: create document, open settings, print, delete, and archive/close behavior; closed documents render in the closed tab and do not show active-only actions.
- AC3: Creating a `cleaning` document matches the screenshots and persists through the existing `journal-documents` API: document title, responsible cleaning role, responsible control role, and seeded defaults derived from the current organization users.
- AC4: Document settings match the screenshots and persist document title plus separate responsible role/employee pairs for cleaning and control using real organization users where available, with sensible fallbacks when data is sparse.
- AC5: The `cleaning` detail page matches the screenshot structure: breadcrumbs, page title, journal settings button, auto-fill panel, print-style HACCP header, add menu, monthly matrix, legend, and lower scope table.
- AC6: The monthly matrix is modeled from the screenshots and supports at minimum:
  - room rows with room name and detergent/disinfectant text
  - daily cells for the document period
  - explicit responsible rows for cleaning and control
  - row selection and bulk delete for editable rows
  - persisted editing through the current document/entries APIs without introducing a separate storage system outside the current journal document model
- AC7: The add menu matches the screenshots and supports the three creation flows:
  - add room
  - add responsible for cleaning
  - add responsible for control
- AC8: Room add/edit flows match the screenshots and persist room name, detergents/disinfectants, current-cleaning scope, and general-cleaning scope in the document config.
- AC9: Auto-fill logic matches the screenshoted intent: when enabled, the journal can populate daily cells for the active period; a `skip weekends` option suppresses weekend filling; generated responsible rows reflect current chosen responsible persons.
- AC10: Test/default data is seeded from live organization context where possible: rooms from areas or sensible cleaning defaults, personnel from active users, and at least one active document is available on first open if none exists.
- AC11: Visible Russian strings in the touched cleaning flow render correctly in UTF-8 Cyrillic with no mojibake in list page, document page, dialogs, table headers, legend, or buttons.
- AC12: Fresh verification on the current codebase passes for the changed cleaning files, all acceptance criteria are marked `PASS`, and the final branch state is pushed to `master` to trigger autodeploy.

## Constraints
- Freeze spec only in this step; no implementation changes beyond this file.
- Keep the implementation scoped to the `cleaning` journal flow and directly related helpers/routes/API wiring.
- Reuse the current journal document architecture (`JournalDocument` + `JournalDocumentEntry`) and adapt the config shape only as far as needed for screenshot parity.
- Use bounded fan-out subagents for exploration/implementation/verification as requested, while keeping proof-loop ownership in this task directory.

## Non-goals
- Redesigning unrelated journals.
- Replacing the global dashboard layout or header/footer.
- Introducing a new database table for cleaning journals if the existing document model can support the requirements.

## Verification plan
- Targeted `eslint` on touched files
- Targeted build/type verification if touched code requires it
- Marker checks for list-page actions, detail-page matrix, dialogs, and config/API persistence paths
- Final git push to `master` and confirmation that push succeeded

## Key risks
- The current `cleaning` config model is materially different from the screenshoted room/day matrix and may require careful compatibility shims.
- Existing seeded `cleaning` documents may contain legacy config and entry data that must be normalized safely.
- The list page currently uses generic tracked UI, so routing and page branching changes must avoid regressions for other journals.
