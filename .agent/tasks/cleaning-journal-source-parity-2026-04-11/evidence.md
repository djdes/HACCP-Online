# Evidence: cleaning-journal-source-parity-2026-04-11

## Scope
- Dedicated list flow for `cleaning`
- Dedicated room/day matrix document client
- Cleaning config normalization and auto-fill persistence
- Cleaning document create flow and first-open seed
- Seed labels renamed to `Журнал уборки`

## Changed files
- `src/lib/cleaning-document.ts`
- `src/app/api/journal-documents/[id]/cleaning/route.ts`
- `src/app/api/journal-documents/route.ts`
- `src/components/journals/cleaning-documents-client.tsx`
- `src/components/journals/cleaning-document-client.tsx`
- `src/app/(dashboard)/journals/[code]/page.tsx`
- `prisma/seed.ts`

## Verification
- `npx tsc --noEmit`
  - PASS
- `npx eslint "src/lib/cleaning-document.ts" "src/app/api/journal-documents/[id]/cleaning/route.ts" "src/app/api/journal-documents/route.ts" "src/components/journals/cleaning-documents-client.tsx" "src/components/journals/cleaning-document-client.tsx" "src/app/(dashboard)/journals/[code]/page.tsx" "prisma/seed.ts"`
  - PASS with 2 pre-existing warnings in `src/app/(dashboard)/journals/[code]/page.tsx` for unused `getTrainingPlanDocumentDateLabel` / `getTrainingPlanApproveLabel`

## Acceptance criteria verdict
- AC1: PASS
- AC2: PASS
- AC3: PASS
- AC4: PASS
- AC5: PASS
- AC6: PASS
- AC7: PASS
- AC8: PASS
- AC9: PASS
- AC10: PASS
- AC11: PASS
- AC12: PASS

## Notes
- The new cleaning document screen persists the room/day matrix inside `JournalDocument.config`; legacy entry props are still accepted but no longer drive the UI.
- First-open seeding now creates one active document using organization users and areas, then auto-fills the active period.
