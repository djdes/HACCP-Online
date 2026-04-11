# Task Spec: uv-bactericidal-parity-2026-04-11

## Metadata
- Task ID: uv-bactericidal-parity-2026-04-11
- Created: 2026-04-11
- Repo root: C:\www\Wesetup.ru

## Guidance sources
- AGENTS.md
- CLAUDE.md
- journals\Журнал учета работы УФ бактерицидной установки\*
- tmp-source-journals\full-crawl\08-item-docs-bactericiplantjournal-1\*
- src\components\journals\uv-lamp-runtime-documents-client.tsx
- src\components\journals\uv-lamp-runtime-document-client.tsx
- src\lib\uv-lamp-runtime-document.ts
- src\lib\document-pdf.ts
- src\app\(dashboard)\journals\[code]\page.tsx

## Original task statement
Freeze spec only for task ID `uv-bactericidal-parity-2026-04-11` in repo `C:\www\Wesetup.ru`. User scope is journal `uv_lamp_runtime` / `Журнал учета работы УФ бактерицидной установки`. First inspect the current implementation, the screenshot folder in `journals\Журнал учета работы УФ бактерицидной установки\`, and the source-site artifacts in `tmp-source-journals\full-crawl\08-item-docs-bactericiplantjournal-1\`, then write a frozen spec covering: visual parity with screenshots/source, correct journal logic and DB-backed CRUD, working buttons, print always opening a PDF table page, full verification, and deployment follow-through. Do not implement code in this step.

## Current repo findings
- The journal already exists in the current dashboard flow as template code `uv_lamp_runtime` and is wired in `src/app/(dashboard)/journals/[code]/page.tsx` to `UvLampRuntimeDocumentsClient`.
- The journal has dedicated list/detail UI files, dedicated normalization/helpers in `src/lib/uv-lamp-runtime-document.ts`, and PDF rendering logic inside shared `src/lib/document-pdf.ts`.
- The local screenshot folder contains both list/archive screenshots and long detail-page screenshots for this journal.
- The source crawl contains active and archive captures for `bactericiplantjournal`, which matches the requested journal and confirms the list page structure and archive tab behavior.
- The current UV-specific source strings in code show mojibake in multiple files; readable Russian text is therefore part of parity and not optional cleanup.
- The current PDF generator already contains a UV-specific branch with specification metadata and a runtime table; later implementation must preserve the shared PDF route instead of introducing a parallel print surface.

## Task goal
Bring the existing `uv_lamp_runtime` journal to source/screenshot parity for `Журнал учета работы УФ бактерицидной установки`, while keeping it inside the current journal-document architecture, with real DB-backed behavior, working controls, and print buttons that always open the shared PDF route.

## Assumptions
- The task upgrades the existing `uv_lamp_runtime` journal rather than adding a second template for the same business journal.
- Screenshot parity means the local UI should be close enough for direct side-by-side comparison with the stored screenshots and source captures: same overall structure, key controls, typography hierarchy, spacing intent, card/table organization, and dialog content. Exact pixel cloning is desirable where practical but not required if the screenshots can be matched faithfully within the current app shell.
- The screenshot folder plus the stored source crawl are the authorities for visual and behavioral expectations; if one artifact is incomplete, the other may fill the gap.
- The print requirement means every visible `Печать` affordance for this journal must open the existing `/api/journal-documents/[id]/pdf` route in a new page/tab and that route must return a PDF table, not HTML and not a dead link.
- The task includes end-to-end verification and deploy follow-through in the later implementation phase; this spec must define the gate for both.

## Constraints
- Freeze spec only in this step; do not implement production changes beyond this file.
- Reuse the existing journal-document storage, routes, and shared PDF generation path.
- Do not satisfy any required flow with client-only mock state when the repo already has DB-backed document and entry persistence.
- Preserve unrelated journals and shared dashboard behavior.
- All visible Russian text in this journal flow must render as valid UTF-8 Cyrillic.

## Non-goals
- Redesigning the whole dashboard shell or unrelated journal templates.
- Replacing the shared `document-pdf` subsystem.
- Introducing a second print endpoint just for this journal.
- Expanding the business model beyond what the screenshots/source/current UV model justify.

## Acceptance criteria

### AC1. Journal identity and routing
The requested journal is implemented as the existing `uv_lamp_runtime` journal inside the current dashboard/document routing model.

Pass conditions:
- The journal is reachable through the current journal route for code `uv_lamp_runtime`.
- The list page and document page use the existing journal/document routes and do not create duplicate routes for the same journal.
- The journal title is shown as `Журнал учета работы УФ бактерицидной установки` wherever the source/screenshots require the canonical title.
- No duplicate template card or duplicate business journal is introduced.

### AC2. UTF-8 Russian copy parity
All UV-journal-specific user-facing labels render as readable Russian text.

Pass conditions:
- The list page, document page, dialogs, buttons, dropdown items, settings labels, table headers, empty states, confirmations, and PDF output contain valid Cyrillic instead of mojibake.
- Journal-specific labels match the source/screenshots closely enough to avoid semantic drift.

### AC3. List page visual parity
The UV journal list page matches the stored screenshots/source captures for active and closed states.

Pass conditions:
- The page shows the same high-level layout seen in the source: page title, instruction/create actions, active/closed tabs, and document cards.
- The archive/closed tab reflects the source behavior and title treatment, including the visible closed-state framing shown in screenshots.
- Document cards present the expected summary fields from the screenshots/source: document title, responsible block, start date block, and overflow actions.
- Card spacing, border treatment, and action placement are aligned closely enough for side-by-side comparison with the screenshots.

### AC4. List page actions and buttons
Every button and overflow action shown for the UV list page works through real routes/APIs.

Pass conditions:
- Creating a document from the list page opens the intended flow and produces a persisted document.
- Opening a document card navigates to the correct document page.
- Overflow actions shown in the source/screenshots work for the appropriate state: print, edit/settings where applicable, delete where applicable, and moving between active/closed where the source shows it.
- No visible UV-journal button is left as a dead control or placeholder.

### AC5. Document page visual parity
The UV document page matches the long-form screenshot/source structure.

Pass conditions:
- The page includes the expected header/title area, action row, specification/config section, runtime table, monthly summary area if present, and footer/action placement in the same overall order as the screenshots.
- The main table density and long-sheet behavior visually match the source intent rather than collapsing into a generic compact CRUD grid.
- The document page remains readable on the current app shell without breaking layout for long monthly/daily tables.

### AC6. Specification/settings parity and persistence
The UV-specific settings/specification UI supports the fields evidenced by the screenshots/source and persists them.

Pass conditions:
- The journal supports editing and saving lamp number, area/object name, disinfection object flags, microorganism type, radiation mode, disinfection conditions, lamp lifetime hours, commissioning date, minimum interval, control frequency, and responsible defaults where the current model supports them.
- Saved settings update persisted document/config state via the existing document APIs.
- Reloading the page shows the same saved values.
- The saved settings are reflected consistently in list labels, document header/spec section, and printable output.

### AC7. Entry table logic and DB-backed CRUD
The UV runtime table works as a persisted document journal rather than client-only draft state.

Pass conditions:
- Rows are built for the intended date range according to the document status/current journal rules.
- Entry edits for date row data persist through the existing journal-document storage layer.
- Start time, end time, responsible employee, and any UV-row fields present in the UI can be updated and survive reload.
- Behavior for active vs closed documents is enforced consistently; closed documents are read-only unless the source explicitly shows otherwise.

### AC8. Duration and summary correctness
UV runtime calculations follow the current business logic and remain consistent across UI and PDF.

Pass conditions:
- Per-row duration is calculated correctly from `startTime` and `endTime`, including same-day and overnight crossings if the current logic allows them.
- Monthly usage/remaining-hours summaries, if shown on the document page, use the persisted entries and configured lamp lifetime.
- Displayed totals do not drift between document UI and PDF for the same saved data.

### AC9. Responsible person handling
Responsible person data works end to end for this journal.

Pass conditions:
- The journal can save and reload default responsible title/user at document level where the flow supports it.
- Entry rows resolve and display responsible employee data from real organization users.
- List cards, detail view, and PDF show consistent responsible-person information based on persisted data.

### AC10. Print always opens the shared PDF table route
Every UV-journal print entry point opens the shared PDF page and returns a UV table PDF.

Pass conditions:
- The document page print button opens `/api/journal-documents/[id]/pdf` in a new page/tab.
- Any list-page print action for this journal also resolves to the same route for the selected document.
- The response is a PDF document containing the UV journal table/specification content, not HTML and not an empty file.
- The PDF reflects current persisted settings and row data.

### AC11. PDF content parity
The PDF output structurally matches the source journal’s printable table expectations.

Pass conditions:
- The PDF includes the UV-specific specification block and the runtime table with the expected columns: index, date, start time, end time, duration, and responsible person.
- The printable heading and lamp/object identification are consistent with the saved document config and source intent.
- Russian labels in the PDF render correctly using available Unicode font support.

### AC12. Archive/closed behavior parity
The journal’s closed-state behavior matches the screenshots/source and remains operational.

Pass conditions:
- Documents can exist in both active and closed states within the existing journal flow.
- Closed documents appear under the closed tab/state and remain printable.
- The closed-state list actions match source expectations, including returning a document to active if that action is shown in the source.
- Closed-state document editing restrictions are enforced consistently.

### AC13. Verification artifact gate
The later implementation cannot be claimed complete without fresh proof-loop artifacts.

Pass conditions:
- Implementation must produce `evidence.md`, `evidence.json`, and any raw artifacts under `.agent/tasks/uv-bactericidal-parity-2026-04-11/`.
- Verification must be rerun against the current working tree after implementation and after any fixes.
- Every acceptance criterion in this spec must receive an explicit `PASS`/`FAIL` verdict in the verification artifacts.
- If any criterion fails, `problems.md` must be created, the smallest safe fix applied, and verification rerun.

### AC14. Deployment follow-through gate
The later implementation includes post-push deployment verification instead of stopping at local changes.

Pass conditions:
- After implementation, changes are pushed to the intended remote branch.
- The deployment/autodeploy status is checked after push.
- If autodeploy fails because of code or configuration regressions introduced by the task, the implementation loop includes the smallest safe fix and a repeat of verification/push as needed.
- Completion cannot be claimed while the latest pushed revision for this task is in a known failed deploy state caused by the task changes.

## Verification plan
- Compare local list and detail UI against `journals\Журнал учета работы УФ бактерицидной установки\*` and source captures in `tmp-source-journals\full-crawl\08-item-docs-bactericiplantjournal-1\*`.
- Verify readable UTF-8 Russian labels across list, detail, dialogs, overflow menus, and PDF.
- Verify document creation, open/navigation, active/closed transitions, and delete/restore actions where shown.
- Verify UV specification/settings save and reload behavior.
- Verify row editing persistence and read-only behavior for closed documents.
- Verify duration and any monthly summary calculations against persisted sample data.
- Verify every `Печать` entry point opens `/api/journal-documents/[id]/pdf` and returns a UV PDF table with current data.
- Run fresh project checks required by the touched implementation surface in the later build phase and record them in task evidence.
- After push in the later build phase, verify autodeploy outcome and record the result in evidence.

## Key risks
- Existing mojibake in UV-specific code can hide both visual and behavioral defects, especially in dialogs and PDF labels.
- The long-form document screenshot suggests a dense, source-specific layout; a generic table implementation may be functionally correct but still fail parity.
- Shared PDF generation means UV fixes can regress other journals if the later implementation is not tightly scoped.
- Deploy verification depends on infrastructure feedback outside local runtime, so the later task must explicitly budget for post-push observation and, if needed, a small repair loop.
