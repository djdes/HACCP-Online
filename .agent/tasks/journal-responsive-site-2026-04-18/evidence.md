# Evidence

## Acceptance Criteria

- `AC1` PASS
  - [document-list-ui.tsx](/C:/www/Wesetup.ru/src/components/journals/document-list-ui.tsx) now uses shared responsive heading/action/tab tokens.
  - [tracked-documents-client.tsx](/C:/www/Wesetup.ru/src/components/journals/tracked-documents-client.tsx) collapses tracked document list cards into a stacked mobile layout.
- `AC2` PASS
  - [tracked-document-client.tsx](/C:/www/Wesetup.ru/src/components/journals/tracked-document-client.tsx) now uses tighter shell padding, smaller mobile heading, stacked action row, and safer sticky selection bar spacing.
  - [register-document-client.tsx](/C:/www/Wesetup.ru/src/components/journals/register-document-client.tsx) now uses tighter page shell, stacked toolbar, smaller summary cards, and responsive dialog spacing.
  - [document-page-header.tsx](/C:/www/Wesetup.ru/src/components/journals/document-page-header.tsx) stacks actions on narrow screens.
- `AC3` PASS
  - [journal-responsive.ts](/C:/www/Wesetup.ru/src/components/journals/journal-responsive.ts) keeps real tables inside explicit horizontal scroll viewports while shrinking outer shells.
  - [tracked-document-client.tsx](/C:/www/Wesetup.ru/src/components/journals/tracked-document-client.tsx) still keeps the data table in a dedicated horizontal scroll container instead of breaking the page shell.
- `AC4` PASS
  - [new/page.tsx](/C:/www/Wesetup.ru/src/app/(dashboard)/journals/[code]/new/page.tsx) reduces hero and form container spacing for smaller devices.

## Verification

- `node --import tsx --test src/components/journals/journal-responsive.test.ts`
  - PASS
- `npm run lint -- "src/components/journals/journal-responsive.ts" "src/components/journals/journal-responsive.test.ts" "src/components/journals/document-list-ui.tsx" "src/components/journals/document-page-header.tsx" "src/components/journals/tracked-documents-client.tsx" "src/components/journals/tracked-document-client.tsx" "src/components/journals/register-document-client.tsx" "src/app/(dashboard)/journals/[code]/new/page.tsx"`
  - PASS
- `npx tsc --noEmit --pretty false`
  - PASS
- `npm run build`
  - PASS

## Notes

- I did not run a live authenticated browser pass because this needs a working session inside the dashboard and the request explicitly prioritized implementation over questions.
- The diff is intentionally focused on shared journal/document shells rather than hand-editing every individual document client.
