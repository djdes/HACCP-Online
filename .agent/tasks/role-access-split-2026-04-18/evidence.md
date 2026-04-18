# Evidence

## Acceptance Criteria

- `AC1` PASS
  - `src/components/staff/staff-page-client.tsx` now renders readable `Отвязать TG` in the bulk toolbar and `Отвязать` in the row action.
- `AC2` PASS
  - `src/lib/role-access.ts` centralizes journal-only staff web access.
  - `src/middleware.ts` redirects staff away from restricted workspace sections to `/journals`.
  - `src/components/layout/header.tsx` hides broader workspace/settings navigation for staff and points home to `/journals`.
  - `src/app/(dashboard)/dashboard/page.tsx` and `src/app/(dashboard)/settings/page.tsx` hard-redirect staff to `/journals`.
- `AC3` PASS
  - `src/lib/role-access.ts` preserves full access for management/root.
  - `src/components/layout/header.tsx` continues to show broad nav and settings shortcut when `hasFullWorkspaceAccess(...)` is true.
- `AC4` PASS
  - `src/app/mini/page.tsx` shows only the journal entry point for staff.
  - `src/app/mini/me/page.tsx` redirects staff back to `/mini`.
  - `src/app/mini/shift/page.tsx` redirects staff back to `/mini`.
  - `src/lib/bot/handlers/start.ts` uses a role-aware CTA label via `getBotMiniAppLabel(...)`, so staff get `Открыть журналы`.
- `AC5` PASS
  - Management/root keep full Mini App access via `hasFullWorkspaceAccess(...)`.
  - Telegram `/start` still uses `Открыть кабинет` for management.

## Verification

- `node --import tsx --test src/lib/role-access.test.ts src/lib/staff-telegram-invite.test.ts src/lib/staff-telegram-management.test.ts`
  - PASS
- `npm run lint -- "src/lib/role-access.ts" "src/lib/role-access.test.ts" "src/middleware.ts" "src/components/layout/header.tsx" "src/app/(dashboard)/settings/page.tsx" "src/app/(dashboard)/dashboard/page.tsx" "src/app/mini/page.tsx" "src/app/mini/me/page.tsx" "src/app/mini/shift/page.tsx" "src/lib/bot/handlers/start.ts" "src/components/staff/staff-page-client.tsx"`
  - PASS
- `npx tsc --noEmit --pretty false`
  - PASS
- `npm run build`
  - PASS

## Notes

- Browser verification was not run because this task requires separate employee/manager authenticated sessions. The code-path verification is covered by targeted tests, route guards, lint, types, and production build.
- The repository contains many unrelated modified/untracked files outside this task. They were left untouched.
