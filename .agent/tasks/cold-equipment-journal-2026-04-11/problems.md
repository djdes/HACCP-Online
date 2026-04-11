# Problems

## P1. Local DB unavailable
- `npx tsx prisma/seed-admin.ts` fails with `ECONNREFUSED` to `localhost:5432`.
- Impact: cannot perform local end-to-end verification of journal create/edit/print flows against real DB data.

## P2. Repository-wide TypeScript failures outside this task
- `npx tsc --noEmit --pretty false` reports unrelated failures in other journal files and supporting modules.
- Impact: no full-repo `PASS` gate can be claimed from current repository state.

## P3. Remote deploy verification not yet captured
- Resolved on 2026-04-11.
- Remote deploy completed, `pm2` restarted successfully, and `.build-sha` now reports `43429f0`.
