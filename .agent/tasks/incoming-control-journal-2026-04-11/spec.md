# Task Spec: incoming-control-journal-2026-04-11

## Original task statement
Freeze a spec for a new substantial task in repo `C:\www\Wesetup.ru`. Task ID: `incoming-control-journal-2026-04-11`. User wants screenshot parity for a document-based journal titled `Журнал входного контроля сырья, ингредиентов, упаковочных материалов` (create it if exact one does not exist). Base it on existing project journal patterns. Infer ACs from the screenshots in this thread: active/closed tabs; create/settings/delete/finish/print; document list cards; document page with HACCP print header; action row with add/add from file/edit lists/finish; row selection toolbar; table columns for checkbox, receipt date+time, product name, manufacturer, supplier, transport conditions, packaging/marking/docs compliance, organoleptic evaluation, expiry/shelf-life date+time, notes, responsible; create/settings dialog includes field-name radio for `Предельный срок реализации` vs `Срок годности`; row dialog with date+time, product plus add-new, manufacturer plus add-new, supplier plus add-new, three binary radio groups, expiry date+time, notes, responsible role/employee; list editor for products/manufacturers/suppliers with file import help and dropzone; Excel import modal with exact described columns; DB-backed demo/test data when available; no completion unless fresh verification passes. Write `.agent/tasks/incoming-control-journal-2026-04-11/spec.md` only.

## Task goal
Bring the local document-based journal experience for `Журнал входного контроля сырья, ингредиентов, упаковочных материалов` to screenshot parity with the source-backed `acceptance2journal` variant, using existing journal/document architecture and data patterns already present in the repo.

## Relevant repo context
- The local journal code already exists as `incoming_control`.
- The local title already exists in `src/lib/tracked-document.ts`.
- The current document UI is primarily implemented through `src/components/journals/acceptance-document-client.tsx`.
- Source captures for the exact requested journal exist under `tmp-source-journals/full-crawl/21-item-docs-acceptance2journal-1/`.
- The repo currently contains an ambiguity: `incoming_control` is mapped from `acceptance1journal` in `src/lib/source-journal-map.ts`, while the screenshot-backed journal for this task is `acceptance2journal`.

## Assumptions
- A separate new template should not be introduced if the existing `incoming_control` template can be updated to match the requested title and screenshot-backed behavior.
- “Screenshot parity” means matching the described information architecture, controls, labels, major layout regions, and workflow behavior closely enough for direct visual and interaction comparison; it does not require pixel-identical rendering.
- “DB-backed demo/test data when available” means implementation should use persisted `journalDocument`/config data and seed/sample data patterns already used by document journals, rather than hardcoded client-only examples, whenever the repo already has a corresponding DB-backed path.
- The exact Excel/import column contract should be frozen from the screenshots in this thread plus the source-backed journal behavior, not from the current simplified importer.

## Constraints
- Follow existing project journal/document patterns instead of inventing a new framework.
- Keep the solution inside the current repo task-proof-loop workflow.
- Do not ship a solution that only looks correct with mocked client state if equivalent DB-backed behavior is already supported elsewhere in the repo.
- Preserve current unrelated journal behavior.
- Russian user-facing labels for this journal must render as proper readable Russian text, not mojibake.

## Non-goals
- Do not redesign the broader journals area beyond what is needed for this journal’s parity.
- Do not refactor unrelated document clients or source-journal mappings unless required to make this journal correct.
- Do not expand import support beyond the screenshot-defined/manual-file-import scope for this journal.
- Do not claim parity for print/export formats other than the HACCP-style print/header flow explicitly in scope.

## Acceptance criteria

### AC1. Journal identity and routing
The repo exposes a document-based journal titled exactly `Журнал входного контроля сырья, ингредиентов, упаковочных материалов` through the existing journal system.

Pass conditions:
- If an exact journal already exists, implementation upgrades that journal instead of creating a conflicting duplicate.
- If the exact journal does not exist in the applicable template/seed path, it is created using existing project patterns.
- The journal resolves through the existing dashboard/journal routes and opens a document list page consistent with other document journals.
- The implementation targets the screenshot-backed `acceptance2journal` behavior for this task, even if older sibling mappings also exist in the repo.

### AC2. Document list page parity
The journal list page matches the requested screenshot-backed document-list experience.

Pass conditions:
- The page shows active and closed tabs/states for documents.
- The page exposes create, settings, delete, finish/close, and print actions where the screenshots show them.
- Document cards/list items render the expected summary presentation, including title and responsible/date metadata aligned with the screenshots.
- Closed documents are visible through the closed tab/state rather than disappearing from the journal.
- The list page uses persisted document records, not static placeholders only.

### AC3. Document header and main action row
Opening a document shows the requested document page structure and top actions.

Pass conditions:
- The document page includes the HACCP-style print/header block described by the screenshots.
- The document page includes the action row with `Добавить`, `Добавить из файла`, `Редактировать списки`, and `Закончить журнал` or equivalent screenshot-matching labels/actions.
- A print action is available from the appropriate list/detail location per the screenshots.
- Closed documents are presented read-only or otherwise non-editable in a way consistent with the existing journal architecture and screenshot intent.

### AC4. Table structure and row-selection behavior
The document table matches the screenshot-defined column set and selection workflow.

Pass conditions:
- The table includes columns for:
  - checkbox selection
  - receipt date and time
  - product name
  - manufacturer
  - supplier
  - transport conditions
  - packaging/marking/docs compliance
  - organoleptic evaluation
  - expiry or shelf-life date and time
  - notes
  - responsible
- Manufacturer and supplier are represented as distinct columns, not collapsed into one combined field.
- Selecting one or more rows reveals a row-selection toolbar with at least the expected destructive action(s) from the screenshots.
- Selection affordances are disabled or otherwise safely constrained for closed documents.

### AC5. Create/settings dialog parity
The create/settings flow for a document matches the required fields and persistence behavior.

Pass conditions:
- The dialog supports document title/name and start date.
- The dialog includes the radio choice for field-name wording:
  - `Предельный срок реализации`
  - `Срок годности`
- The dialog supports responsible role/title and responsible employee selection.
- Saved settings persist to the document/config and immediately affect the table/header labels where applicable.
- The same persisted settings are reflected after reload.

### AC6. Row dialog parity
The add/edit row dialog matches the screenshot-defined data entry workflow.

Pass conditions:
- The dialog includes receipt date and time inputs.
- The dialog includes product selection plus add-new input/action.
- The dialog includes manufacturer selection plus add-new input/action.
- The dialog includes supplier selection plus add-new input/action.
- The dialog includes three binary radio groups for:
  - transport conditions
  - packaging/marking/docs compliance
  - organoleptic evaluation
- The dialog includes expiry or shelf-life date and time inputs.
- The dialog includes notes.
- The dialog includes responsible role/title and responsible employee.
- Saving a row updates persisted document config/data and re-renders correctly in the table.

### AC7. List editor parity
The list editor for products, manufacturers, and suppliers matches the requested editing/import workflow.

Pass conditions:
- The user can open a dedicated list editor from the document page.
- The editor supports all three lists: products, manufacturers, suppliers.
- The editor includes file import help text/instructions and a visible dropzone-style import affordance, consistent with the screenshots.
- Imported or newly added list items persist to document config and become available in the row dialog after reload.

### AC8. Excel/file import parity
The journal supports the screenshot-defined file import flow for rows.

Pass conditions:
- The user can open an Excel/file import modal or equivalent explicit import UI rather than relying only on a hidden file input.
- The import UI documents the exact expected columns from the screenshots/thread.
- Import parsing maps those exact described columns into persisted row data for this journal.
- Import handles date/time fields and binary yes/no style fields according to the frozen column contract.
- Import failures produce a user-visible error path instead of silent partial success.

### AC9. Data persistence and demo/test data
The journal works with DB-backed data and demo/test data patterns where available.

Pass conditions:
- Documents, settings, and rows are backed by persisted journal document/config data.
- If the repo already has a demo/test data path for this journal family, the implementation uses or extends it so the journal is verifiable without manual DB crafting.
- No required screenshot-parity surface depends exclusively on ephemeral client memory.

### AC10. Fresh verification gate
Task completion is blocked on a fresh verification pass against the current codebase.

Pass conditions:
- Verification is rerun after implementation against the current working tree.
- Every acceptance criterion is explicitly checked during verification.
- Completion is not claimed unless the fresh verification pass is `PASS`.

## Implementation notes for the builder
- Reuse existing `incoming_control` journal/document plumbing where possible.
- Treat the current simplified acceptance document client as a starting point, not as proof that parity is already satisfied.
- Resolve the `acceptance1journal` vs `acceptance2journal` ambiguity in favor of the exact requested journal/screenshots for this task.
- Keep print/header, list page, detail page, row dialog, list editor, and import flow behavior aligned with existing document-journal patterns elsewhere in the repo when those patterns already solve similar problems.

## Verification plan
- Verify the journal entry point/title/routing for the exact requested journal.
- Verify active and closed document list states and list-card actions.
- Verify document detail page header, action row, and print entry point.
- Verify table columns and row-selection toolbar against the frozen column set.
- Verify create/settings dialog persistence, especially the expiry-field label radio.
- Verify row add/edit flow, including add-new list values and responsible fields.
- Verify list editor UI, dropzone/help copy, persistence, and reuse in the row dialog.
- Verify Excel/file import UI, documented columns, successful import, and failure handling.
- Verify DB-backed persistence and any available demo/test data path.
- Record `PASS` only if all ACs pass on a fresh run.
