# Problems: perishable-rejection-parity-2026-04-11

## Verification gaps
- `AC3` FAIL: list page still does not visually match the stored source screenshot one-to-one.
- `AC5` FAIL: detail page header/breadcrumb/settings layout still differs from the stored screenshot set.
- `AC4`, `AC7`, `AC8`, `AC9`, `AC11` are INCONCLUSIVE because local DB-backed runtime verification is blocked by unavailable `DATABASE_URL`.
- `AC12` FAIL until the above gaps are either fixed or conclusively verified.

## Deployment blocker found during finish phase
- Manual deploy on the server failed at `npx prisma generate` because `prisma.config.ts` imports `dotenv/config`, but `dotenv` was not declared in `package.json`.
- This likely also explains the missing GitHub Actions deploy progression after the empty trigger push.

## Smallest safe next fix
- Add `dotenv` as a direct dependency so both GitHub Actions and manual deploy can run `prisma generate` consistently.
