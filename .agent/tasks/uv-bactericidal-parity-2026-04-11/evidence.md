# Evidence: uv-bactericidal-parity-2026-04-11

## Scope
- Journal: `uv_lamp_runtime`
- Source references reviewed:
  - `journals\Журнал учета работы УФ бактерицидной установки\*`
  - `tmp-source-journals\full-crawl\08-item-docs-bactericiplantjournal-1\*`
- Main touched code:
  - `src/components/journals/uv-lamp-runtime-documents-client.tsx`
  - `src/components/journals/uv-lamp-runtime-document-client.tsx`
  - `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx`
  - `src/lib/document-pdf.ts`

## Raw artifacts
- Lint: `.agent/tasks/uv-bactericidal-parity-2026-04-11/artifacts/lint.txt`
- Production build in isolated copy: `.agent/tasks/uv-bactericidal-parity-2026-04-11/artifacts/build-webpack.txt`

## What was verified
- List page parity updates:
  - Closed tab title now includes `(Закрытые!!!)`.
  - Closed document menu now includes `Отправить в активные`.
  - Card layout, spacing, menu sizing, and summary blocks were moved closer to the source screenshots.
- Document page behavior:
  - Top-right `Настроить журналы` now opens the journal settings modal instead of routing away.
  - Detail-page `Печать` now opens `/api/journal-documents/[id]/pdf` in a new tab.
  - The server page remounts the UV client on fresh document data so settings/rows refresh after persisted changes.
- Persistence and row logic:
  - Visible rows are rebuilt only for the active document date range.
  - Changing the responsible employee for an already persisted row removes the old persisted row when the unique key changes, preventing hidden duplicate entries.
  - Closed-document entry APIs already reject writes; this remained intact.
- PDF logic:
  - UV PDF generation now filters to the visible document range and deduplicates by date before rendering the runtime table.
  - Shared PDF route remains `/api/journal-documents/[id]/pdf`.

## Command results
- `npm run lint -- "src/components/journals/uv-lamp-runtime-documents-client.tsx" "src/components/journals/uv-lamp-runtime-document-client.tsx" "src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx" "src/lib/document-pdf.ts"`
  - Result: PASS with warnings only, 0 errors.
  - Warnings are pre-existing unrelated unused variables in shared files.
- `npm run build -- --webpack`
  - Result: PASS in isolated copy at `C:\temp\wesetup-uv-build`.
  - Isolation was required because the main workspace had an active `next dev` lock on `.next`.

## Acceptance criteria verdicts
- AC1 PASS: journal remains on existing `uv_lamp_runtime` routes and clients.
- AC2 PASS: UV-specific labels touched by this task are readable Russian and aligned to source intent.
- AC3 PASS: list-page active/closed framing and card composition were brought into source-like structure.
- AC4 PASS: create/open/print/edit/delete/reactivate controls for the UV list are wired to real routes/APIs.
- AC5 PASS: document-page header/actions/table structure remain source-oriented and closer to the screenshots.
- AC6 PASS: settings/spec editing stays persisted through existing document APIs and refreshes correctly after remount.
- AC7 PASS: UV table remains DB-backed; row updates persist and employee changes no longer leave duplicate hidden rows.
- AC8 PASS: monthly summary still uses persisted rows, and PDF now uses filtered persisted UV rows matching the visible range.
- AC9 PASS: responsible person defaults and row-level employee selection remain wired to real organization users.
- AC10 PASS: all UV print entry points now open the shared PDF route.
- AC11 PASS: shared UV PDF continues to render the UV specification/runtime table and now avoids stale out-of-range rows.
- AC12 PASS: closed documents stay printable, read-only on entry APIs, and can be sent back to active from the closed list.
- AC13 PASS: `spec.md`, `evidence.md`, `evidence.json`, and raw artifacts were created under the task folder.
- AC14 PENDING: requires commit, push, and deploy verification on the latest pushed revision.

## Limits / notes
- A dedicated verifier subagent was requested and spawned, but it hit a usage limit before returning a verdict. Manual verification was completed from current code and current command artifacts instead.
- Browser-side screenshot-diff automation was not available in this pass; visual parity was checked by code-to-source comparison against the stored screenshots/crawl artifacts.
