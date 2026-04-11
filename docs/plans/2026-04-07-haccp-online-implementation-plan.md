# HACCP-Online Implementation Plan

**Date:** 2026-04-07
**Author:** Codex
**Status:** Practical implementation plan for the next development sessions

---

## 1. Recommended Order For Tomorrow

If you want the highest ROI from one day of work, do the following in this order:

1. bring the repo back to a green baseline
2. finish the document-journal flow
3. surface hidden modules in navigation
4. only then start the next feature layer

Reason:

Right now the biggest risk is not lack of ideas. It is unfinished integration between ideas that already exist.

---

## 2. Tomorrow Sprint

## 2.1 Goal

End the day with:

- `npm run lint` passing
- `npm run build` not depending on Google Fonts fetch
- no broken journal document links
- deviation alert rules aligned with actual template fields
- a stable base for feature work

## 2.2 Tasks

### Task A. Fix product-critical inconsistencies

**Files to edit**

- `src/app/api/journals/route.ts`
- `prisma/seed.ts`
- `src/app/(dashboard)/journals/[code]/[entryId]/page.tsx`

**What to do**

1. Align deviation rules with real field keys from the seeded templates.
2. Decide one canonical field vocabulary and use it everywhere.
3. Update any display label map that still reflects old field names.

**Acceptance criteria**

- incoming control alerts fire on rejected intake
- hygiene alerts fire on non-admission to work
- CCP alerts fire on out-of-limit values
- finished product alerts fire on failed release

### Task B. Complete or temporarily rollback document-journal navigation

**Preferred path:** complete it, do not rollback.

**Files to add**

- `src/app/(dashboard)/journals/[code]/documents/[id]/page.tsx`

**Files to edit**

- `src/app/(dashboard)/journals/[code]/page.tsx`
- `src/app/api/journal-documents/[id]/route.ts`
- `src/app/api/journal-documents/[id]/entries/route.ts`

**What to do**

1. Add the missing document detail page.
2. Render the document header, period, responsible person, status, and entry grid.
3. Make sure document links from the list page open a real UI.
4. If the detail page cannot be finished in one pass, at minimum stop linking to a non-existent route.

**Acceptance criteria**

- clicking a document from `/journals/[code]` no longer leads to 404
- users can see document metadata and at least one editable table view

### Task C. Fix baseline quality gate

**Files to edit**

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/batches/page.tsx`
- `src/app/(dashboard)/losses/page.tsx`
- `src/app/(dashboard)/capa/page.tsx`
- `src/app/(dashboard)/capa/[id]/page.tsx`
- `src/components/charts/temperature-chart.tsx`
- `src/components/layout/header.tsx`
- any other files surfaced by eslint

**What to do**

1. Replace inline `Date.now()` render calls with precomputed constants.
2. remove unused imports and dead code
3. replace `any` in the chart tooltip with proper formatter types

**Acceptance criteria**

- `npm run lint` passes cleanly

### Task D. Remove build fragility from remote fonts

**Files to edit**

- `src/app/layout.tsx`
- optionally `src/app/globals.css`

**What to do**

Choose one:

- migrate to `next/font/local`
- or replace with a local/system stack and remove `next/font/google`

**Acceptance criteria**

- `npm run build` works without fetching Google Fonts

### Task E. Expose hidden modules

**Files to edit**

- `src/components/layout/header.tsx`
- optionally `src/app/(dashboard)/settings/page.tsx`

**What to do**

Add clear navigation entry points for:

- losses
- plans
- changes
- competencies

**Acceptance criteria**

- users can discover all implemented modules without direct URL guessing

---

## 3. Next Major Feature: Document Journal Workspace

This is the best feature to build immediately after the stabilization sprint.

## 3.1 Goal

Ship the first full document-based journal flow for one template, ideally `hygiene`.

## 3.2 Scope Of Version 1

### UI

**Files to add**

- `src/components/journals/document-grid.tsx`
- `src/components/journals/document-toolbar.tsx`

**Files to edit**

- `src/app/(dashboard)/journals/[code]/documents/[id]/page.tsx`
- `src/components/journals/create-document-dialog.tsx`

### API

**Files to edit**

- `src/app/api/journal-documents/[id]/route.ts`
- `src/app/api/journal-documents/[id]/entries/route.ts`

### Behavior

1. show active employees as rows
2. show all days in the document period as columns
3. allow editing each cell inline
4. autosave via `PUT /api/journal-documents/[id]/entries`
5. show "active" vs "closed"
6. block edits on closed documents
7. show completion progress

## 3.3 Nice-to-have if time remains

- bulk mark by day
- copy previous row/day
- print stylesheet
- lightweight PDF export

## 3.4 Acceptance criteria

- one document can be created from the journal page
- one employee-day cell can be edited and re-opened after refresh
- closed documents are read-only
- responsible user and title are visible in the document page

---

## 4. Next Major Feature: Compliance Center

Build this only after the document journal workspace is stable.

## 4.1 Goal

Create one place where the organization sees daily compliance status and next required actions.

## 4.2 Files to add

- `src/lib/compliance.ts`
- `src/app/(dashboard)/compliance/page.tsx`
- `src/components/compliance/compliance-board.tsx`

## 4.3 Files to edit

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/api/cron/compliance/route.ts`
- `src/app/(dashboard)/journals/page.tsx`

## 4.4 What to implement

1. create one shared compliance calculator in `src/lib/compliance.ts`
2. compute required journals for the day
3. detect done / missing / overdue states
4. surface direct actions:
   - create entry
   - open active document
   - create missing document
5. make cron reminders reuse the same logic
6. reuse the same compliance engine in dashboard widgets

## 4.5 Acceptance criteria

- dashboard and cron no longer implement separate compliance rules
- the app can explain why something is "missing"
- users can go from problem -> fix in one click

---

## 5. Next Major Feature: Batch Traceability

Build this after Compliance Center, or in parallel only if you are comfortable doing a schema migration.

## 5.1 Goal

Make batch flow auditable end-to-end.

## 5.2 Suggested approach

### Step 1. Strengthen source linking

**Files to edit**

- `src/app/api/batches/route.ts`
- `src/app/api/journals/route.ts`
- `src/app/(dashboard)/batches/[id]/page.tsx`

**What to do**

- always store `sourceEntryId` when a batch is created from incoming control
- show source journal entry on the batch detail page

### Step 2. Add trace events

**Schema idea**

Add one of these:

- `BatchEvent`
- or generic `TraceLink`

The important part is not the exact name. The important part is storing a timeline of connected events.

### Step 3. Show batch genealogy in UI

**Files to add**

- `src/components/batches/batch-timeline.tsx`

**Files to edit**

- `src/app/(dashboard)/batches/[id]/page.tsx`
- `src/app/(dashboard)/capa/[id]/page.tsx`

### Step 4. Link related modules

- loss records referencing a batch
- CAPA tickets referencing source entry or batch
- write-off events referencing batch

## 5.3 Acceptance criteria

- from a batch you can see where it came from
- from a deviation you can see which batches were affected
- traceability no longer depends on manual note fields

---

## 6. Secondary Fixes Worth Scheduling Early

These are not the main feature track, but they should be folded into nearby work.

### 6.1 Barcode and OCR completion

**Files**

- `src/components/journals/barcode-scanner.tsx`
- `src/app/api/products/lookup/route.ts`
- `src/components/journals/dynamic-form.tsx`

**Plan**

- fix response contract mismatch
- actually mount barcode scanning in incoming control
- support quick-fill from product catalog + barcode + OCR in one consistent flow

### 6.2 Audit log wiring

**Files**

- `src/lib/audit.ts`
- most mutating API routes under `src/app/api`

**Plan**

- add `logAudit` calls to create/update/delete flows
- start with users, equipment, areas, batches, CAPA, journal status changes

### 6.3 Security / trust cleanup

**Files**

- `src/app/api/users/invite/route.ts`
- `src/lib/email.ts`

**Plan**

- stop sending plaintext passwords by email
- move to either one-time setup link or temporary password reset flow

---

## 7. Suggested Weekly Sequence

## Day 1

- repo green
- document route fixed
- nav improved

## Day 2

- document detail page
- editable grid
- close/open document

## Day 3

- print/PDF for documents
- completion stats
- hygiene template fully supported in document mode

## Day 4

- shared compliance engine
- compliance page
- dashboard reuse

## Day 5

- batch source linking
- traceability timeline first pass

---

## 8. Verification Checklist

Run after each phase:

```bash
npm run lint
npm run build
```

Manual checks:

1. create a journal entry
2. trigger a deviation and verify notifications
3. create a journal document
4. open the document and edit a cell
5. close the document and verify read-only behavior
6. verify dashboard compliance numbers match actual data
7. verify batch detail shows linked source events

---

## 9. If You Want The Fastest Win

If you only choose one feature after stabilization, choose the document-based journal workspace.

It is the feature with the best combination of:

- existing groundwork in code
- real user value
- audit/compliance impact
- differentiation potential
