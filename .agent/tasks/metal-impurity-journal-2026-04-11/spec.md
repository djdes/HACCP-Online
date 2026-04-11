# Task Spec: metal-impurity-journal-2026-04-11

## Metadata
- Task ID: metal-impurity-journal-2026-04-11
- Created: 2026-04-11
- Repo root: C:\www\Wesetup.ru

## Guidance sources
- AGENTS.md
- CLAUDE.md
- src/lib/metal-impurity-document.ts
- src/components/journals/metal-impurity-documents-client.tsx
- src/components/journals/metal-impurity-document-client.tsx
- src/app/(dashboard)/journals/[code]/page.tsx
- src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx
- tmp-source-journals/live-metalimpurity-doc-detail/*
- User-provided screenshots in the task thread

## Original task statement
Align the existing metal impurity journal with the provided screenshots and behavior, using the current journal architecture and DB-backed data where available.

## Current repo findings
- The journal already exists under template code `metal_impurity` with dedicated list and document clients.
- The repo contains captured source HTML/JSON for the same journal slug `metalimpurityjournal`, including active and closed document states.
- The current implementation appears functionally close, but multiple strings in the metal impurity files are mojibake-corrupted and must be treated as defects during implementation.

## Acceptance criteria
- AC1: The journal list page for `metal_impurity` matches the screenshots for both tabs: active documents show the page title, instruction button, create button, one-line document cards with responsible person, start date, overflow actions; closed documents show the closed-state title variant and omit creation and active-only actions.
- AC2: Creating, editing, printing, and deleting a metal impurity document from the list page follow the screenshoted behavior and persist through the existing journal document API without introducing a parallel storage path.
- AC3: The document detail page matches the screenshots in structure and wording: breadcrumbs, title block, settings button, HACCP-style printable header, centered journal caption, action row, records table, footer/social area parity as inherited from the shared dashboard layout, and closed-state read-only behavior.
- AC4: The records table exposes the screenshoted columns and logic: selection checkbox, date, supplier, raw material, consumed quantity in kg, metal-magnetic impurity quantity in g, impurity characteristic, derived mg per 1 kg flour value, and responsible employee name.
- AC5: The derived "mg per 1 kg flour" cell is calculated from row data consistently with the current journal logic and remains stable after create/edit/save/reload/print flows.
- AC6: The add/edit row dialog matches the screenshot flow: date, supplier selection plus add-new input, raw material selection plus add-new input, consumed quantity, impurity quantity, impurity characteristic, responsible position, responsible employee, and save button; editing preloads existing values.
- AC7: The list-editing dialog matches the screenshots for both sections ("Сырье" and "Поставщики"): checkbox rows, inline rename affordance, add-new input with plus button, Excel import entry point, help copy about first sheet / first column / first row, upload dropzone, and save/close behavior backed by the document config.
- AC8: The document settings dialog matches the screenshots and persists document title, start date, responsible position, and responsible employee using real available user data from the current organization context, with sensible fallback only when DB data is absent.
- AC9: Finishing a journal matches the screenshots and source behavior: active documents can be closed via confirmation dialog, closure persists document status and end date, and the closed document becomes read-only and appears under the closed tab.
- AC10: All visible Russian labels in the metal impurity journal flow render correctly in UTF-8 Cyrillic; no mojibake text remains in list page, document page, dialogs, buttons, table headers, empty states, or print view.
- AC11: Default and test-visible data for materials, suppliers, responsible roles, employees, and starter rows come from existing DB-backed journal/user context where available and stay compatible with current seed/demo data so the screenshots can be reproduced without manual data patching.
- AC12: The final implementation remains consistent with the project's existing journal patterns and passes fresh verification against the current codebase, including build and the targeted checks needed for this journal.

## Constraints
- Freeze spec only in this step; no production implementation changes beyond this file.
- Keep the implementation scoped to the metal impurity journal flow and directly related helpers/routes.
- Reuse existing journal APIs, shared dashboard layout, and current data model unless a minimal schema-safe adjustment is proven necessary later.
- Prefer the smallest safe diff that restores screenshot parity and working behavior.

## Non-goals
- Redesigning unrelated journals.
- Replacing the shared document system.
- Adding behavior that is not supported by the screenshots, source captures, or existing journal conventions.

## Verification plan
- `npm run build`
- `npm run lint` if metal impurity UI/helper files change materially
- Targeted manual verification of:
  - active list page
  - closed list page
  - create document
  - document settings
  - add row
  - edit row
  - edit lists including Excel import UI presence
  - finish journal
  - delete document
  - print view

## Key risks
- Existing mojibake in the current implementation can hide label mismatches across multiple UI states.
- Screenshot parity may require careful alignment between seeded fallback data and DB-derived organization/user data.
- The Excel import UI exists in the current document client and may need behavior/UI refinement without breaking persisted config shape.
- Closed-state behavior spans both list and document routes, so status/date handling must remain consistent through the shared journal document API.
