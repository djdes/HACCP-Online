# Evidence

## Summary

- Dashboard count now uses enabled selected journal templates instead of the old `ALL_DAILY_JOURNAL_CODES` subset.
- Bulk TasksFlow assignment now targets all enabled unfilled selected journals.
- Normal journal-per-day templates assign one TasksFlow task per journal document.
- Per-employee journals (`hygiene`, `health_check`) still fan out to eligible staff.
- Manager hierarchy permissions, candidate employee scope, existing links, and TasksFlow user links are validated before creating tasks.
- Skipped journals create WeSetup management notifications with a staff hierarchy link.

## Verification

- `npx tsx --test src/lib/tasksflow-bulk-assign.test.ts` passed: 7/7.
- `npx tsx --test src/lib/tasksflow-bulk-assign.test.ts src/lib/tasksflow-journal-ui.test.ts src/lib/tasksflow-user-sync.test.ts` passed: 13/13.
- `npx eslint 'src/app/api/integrations/tasksflow/bulk-assign-today/route.ts' 'src/app/(dashboard)/dashboard/page.tsx' 'src/components/dashboard/bulk-assign-today-button.tsx' 'src/lib/today-compliance.ts' 'src/lib/tasksflow-bulk-assign.ts' 'src/lib/tasksflow-bulk-assign.test.ts'` passed with 0 errors and 3 pre-existing warnings in `today-compliance.ts`.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed.
