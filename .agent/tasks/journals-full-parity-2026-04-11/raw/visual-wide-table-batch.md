# Visual Wide Table Batch

Date: 2026-04-12

## Defect class

Shared detail-page table defect on narrow screens:
- print-oriented tables shipped with large base `min-w-[...]` values
- horizontal containers existed, but the default mobile width still started too wide
- some detail pages lacked explicit `max-w-full` containment on the scroll wrapper

## Classification

Systemic, not local-only. The same wide-table baseline pattern appeared across multiple detail-page journals.

## Code changes in this batch

- `src/components/journals/acceptance-document-client.tsx`
- `src/components/journals/cleaning-document-client.tsx`
- `src/components/journals/pest-control-document-client.tsx`
- `src/components/journals/traceability-document-client.tsx`
- `src/components/journals/uv-lamp-runtime-document-client.tsx`

## Smallest safe remediation pattern

- wrapper: `max-w-full overflow-x-auto`
- tables: smaller base `min-w` on mobile, restore large print/desktop widths with `sm:min-w-[...]`
- dense column headers: shift large `min-w-[...]` values to `sm:` and keep narrower mobile baselines

## Re-check scope

Rechecked globally against the shared wide-table detail-page class. Remaining likely follow-up class is:
- oversized top-level list headings in some journals

## Fresh checks

- `npx eslint ...` on the touched detail-page files: PASS with pre-existing warnings only
- `npx tsc --noEmit`: PASS
