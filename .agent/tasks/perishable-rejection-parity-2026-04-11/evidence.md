# Evidence: perishable-rejection-parity-2026-04-11

## Summary
- Verified the current repository state for `perishable_rejection` against the frozen spec.
- Critical print/PDF support for the journal is present in the current codebase.
- Targeted lint on the touched surface reports warnings only in `src/lib/document-pdf.ts`, no errors.
- A full production build completed successfully once during this session.
- Local end-to-end DB-backed runtime verification was blocked because the local database connection was unavailable (`ECONNREFUSED` when attempting to seed/query admin data).
- The working tree contains many unrelated concurrent changes, so no safe task-only push was performed from this session.

## Commands and outcomes

### Targeted ESLint
Command:
```powershell
npx eslint src/components/journals/perishable-rejection-document-client.tsx src/components/journals/perishable-rejection-documents-client.tsx src/lib/perishable-rejection-document.ts src/lib/document-pdf.ts src/components/journals/equipment-cleaning-document-client.tsx
```

Outcome:
- PASS for touched task surface.
- Result: 0 errors, 3 warnings in `src/lib/document-pdf.ts` for pre-existing/benign unused locals.

### Full build
Command:
```powershell
npm run build
```

Observed successful run:
- `Compiled successfully`
- `Running TypeScript ...`
- `Generating static pages ...`
- finished with route manifest and no compile/type errors

Notes:
- Later repeat attempts were noisy because concurrent local Next build/start processes kept recreating `.next/lock`.
- The successful build result above is the authoritative build proof for this task session.

### Local runtime / auth / DB
Commands attempted:
```powershell
npx tsx prisma/seed-admin.ts
```

Outcome:
- FAIL for local runtime verification only.
- Result: Prisma `ECONNREFUSED`, so the local DB-backed journal flow could not be exercised end-to-end in this environment.

## Code evidence

### Print button on detail page uses PDF route
- `src/components/journals/perishable-rejection-document-client.tsx`
- The detail-page print action opens `/api/journal-documents/${documentId}/pdf` in a new tab.

### List-page print already uses PDF route
- `src/components/journals/perishable-rejection-documents-client.tsx`
- The list-page action menu print opens `/api/journal-documents/${document.id}/pdf`.

### Dedicated PDF rendering exists for this journal
- `src/lib/document-pdf.ts`
- Current code contains:
  - import/use of `PERISHABLE_REJECTION_TEMPLATE_CODE`
  - `drawPerishableRejectionPdf(...)`
  - a dedicated generator branch for `templateCode === PERISHABLE_REJECTION_TEMPLATE_CODE`
  - dedicated file prefix handling via `getPerishableRejectionFilePrefix()`

### Journal constants/config normalization
- `src/lib/perishable-rejection-document.ts`
- Current code contains:
  - full Russian title constant
  - config normalization
  - storage/organoleptic Russian labels
  - file prefix helper

### Closed-state safeguards on detail page
- `src/components/journals/perishable-rejection-document-client.tsx`
- Current code contains:
  - `const readOnly = status === "closed"`
  - guards for add/remove/list-edit actions
  - inline table inputs disabled in read-only mode
  - dialogs forced closed in read-only mode

## Visual evidence sources used
- `journals\Журнал бракеража скоропортящейся пищевой продукции\054 - 'Бракеражный журнал'.jpg`
- `journals\Журнал бракеража скоропортящейся пищевой продукции\060 - 'Журнал бракеража'.jpg`
- `journals\Журнал бракеража скоропортящейся пищевой продукции\065 - 'Журнал бракеража'.jpg`
- `tmp-source-journals\full-crawl-smoke-2\10-item-docs-brakery1journal-1\01-https-lk-haccp-online-ru-docs-brakery1journal-1.png`

## Remaining blockers
- Local DB runtime unavailable, so no live create/edit/delete/PDF-open browser proof was captured against a real local organization dataset.
- The worktree is dirty with unrelated parallel changes, so pushing from this checkout would risk shipping other threads’ work.
