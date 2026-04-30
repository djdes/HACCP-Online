# Evidence

Task: `tasksflow-integration-fixes-2026-04-24`

## Code Result

- Fix commit: `c2bc98a feat(tasksflow): improve integration settings and auth helpers`
- Current pushed HEAD: `ce1406768bfccccea959434da0deddba2e46ad60`
- `origin/master` equals local `HEAD`
- `git push origin master`: `Everything up-to-date`

## Acceptance Criteria

- AC1 PASS: `tasksflow-settings-client.tsx` uses `readApiJson()` instead of blind `response.json()` for TasksFlow integration fetches.
- AC2 PASS: touched TasksFlow/settings API routes use `requireApiAuth()` / `requireApiRole()` and return JSON 401/403.
- AC3 PASS: `complaintRegisterAdapter` is imported and registered in `SPECIFIC_ADAPTERS`.
- AC4 PASS WITH NOTE: targeted ESLint, TypeScript, diff check, and production build pass. Full `npm run lint` timed out after 5 minutes without diagnostics.
- AC5 PASS WITH FINDINGS: Playwright smoke ran manager/staff desktop/mobile flows against local dev server after enabling the DB tunnel.
- AC6 PASS: fix commit is present in pushed `origin/master`.

## Commands

- `npx eslint <changed files>`: PASS
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS
- `npm run build`: PASS
- `npm run lint`: TIMEOUT after 304 seconds, no diagnostics emitted
- `git push origin master`: PASS, already up to date

## Browser Smoke

Raw artifacts:

- `.agent/tasks/tasksflow-integration-fixes-2026-04-24/raw/playwright/smoke-report.json`
- `.agent/tasks/tasksflow-integration-fixes-2026-04-24/raw/playwright-rerun/smoke-report.json`
- `.agent/tasks/tasksflow-integration-fixes-2026-04-24/raw/playwright-staff/smoke-report.json`

Confirmed:

- unauthenticated `/api/integrations/tasksflow`, `/api/integrations/tasksflow/links`, `/api/settings/journals` return JSON 401;
- manager desktop/mobile pages load without horizontal overflow: dashboard, TasksFlow settings, journals, reports, journal settings, users;
- staff mobile pages load without horizontal overflow: dashboard route redirects to journals, journals, mini app notice;
- old `/staff` URL now redirects to `/settings/users` with status 200 after login.

Findings from browser smoke:

- `/staff` was 404 before the compatibility redirect; fixed.
- `/journals` and `/settings/users` emitted React hydration warnings in dev. The journal warning mentions nested `<button>` inside `<button>` and should be investigated separately.
- `/mini` outside Telegram correctly shows the "open inside Telegram" notice, but the bottom nav is still visible; this may confuse staff opening it in a normal browser.
