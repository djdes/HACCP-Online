# Evidence

## Scope
- Target journal: `Чек-лист уборки и проветривания помещений`
- Task focus: route parity, dedicated UI, API/DB persistence, dedicated PDF print path, deploy confirmation

## Checks
- Reference assets reviewed from `journals/Чек-лист уборки и проветривания помещений/`
- Confirmed dedicated route wiring:
  - list page branch in `src/app/(dashboard)/journals/[code]/page.tsx`
  - document page branch in `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx`
- Confirmed dedicated print path in `src/lib/document-pdf.ts`
- Confirmed journal create/update config path in `src/app/api/journal-documents/route.ts`
- Confirmed dedicated clients exist:
  - `src/components/journals/cleaning-ventilation-checklist-documents-client.tsx`
  - `src/components/journals/cleaning-ventilation-checklist-document-client.tsx`
- ESLint check passed for the two dedicated client files

## Commands
- `cmd /c npx eslint "src/components/journals/cleaning-ventilation-checklist-document-client.tsx" "src/components/journals/cleaning-ventilation-checklist-documents-client.tsx" --max-warnings=0`
  - PASS
- `npx tsc --noEmit --pretty false`
  - BLOCKED by pre-existing repo error in `src/app/api/journal-documents/[id]/entries/route.ts`
- `npm run build`
  - BLOCKED locally by `.next/lock` access issue
- Production verification over SSH
  - PASS: `.build-sha` = `27d911a8ee19a5e03536955e61bf518eddf3eb78`
  - PASS: `.build-time` = `2026-04-11T18:54:01Z`
  - PASS: `pm2 status haccp-online` = `online`
  - PASS: `curl -I http://127.0.0.1:3002` = `HTTP/1.1 307 Temporary Redirect` to `/login`

## Acceptance Criteria
- AC1: PASS
- AC2: PASS
- AC3: PASS
- AC4: PASS
- AC5: PASS
  - Note: local `next build` remained blocked by a workspace `.next/lock` filesystem issue, but production deploy built successfully from the pushed commit.
- AC6: PASS

## Residual limitations
- I did not complete an authenticated browser screenshot diff against the live app from this environment.
- Local full build verification is currently obstructed by the workspace `.next/lock` access problem, independent of the deployed result.
