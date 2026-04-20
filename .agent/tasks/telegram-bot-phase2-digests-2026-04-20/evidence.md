# Evidence

Task ID: `telegram-bot-phase2-digests-2026-04-20`
Date: `2026-04-20`
Final status: `PASS`

## Scope delivered

- `TelegramLog` enriched with structured delivery metadata for org-aware digest dedupe.
- Reusable delivery policy updated to query `userId + organizationId + kind + dedupeKey`, with legacy fallback for older rows that were written before `organizationId`.
- Staff and manager digest builders ship deterministic daily dedupe keys and now escape HTML-sensitive dynamic labels.
- `/api/cron/mini-digest` now syncs obligations first, sends staff digests from `JournalObligation`, sends manager/root digests per organization, and isolates per-organization and per-user failures instead of dropping the whole run.

## Acceptance Criteria

### AC1
`PASS`

`TelegramLog` now stores structured org-aware metadata:
- `organizationId`, `kind`, `dedupeKey` in [prisma/schema.prisma](../../../prisma/schema.prisma)
- write paths updated in [src/lib/telegram.ts](../../../src/lib/telegram.ts)
- org-aware lookup policy in [src/lib/telegram-delivery-policy.ts](../../../src/lib/telegram-delivery-policy.ts)

### AC2
`PASS`

Reusable delivery-policy helper exists and is covered by tests:
- implementation: [src/lib/telegram-delivery-policy.ts](../../../src/lib/telegram-delivery-policy.ts)
- tests: [src/lib/telegram-delivery-policy.test.ts](../../../src/lib/telegram-delivery-policy.test.ts)

### AC3
`PASS`

`/api/cron/mini-digest` now:
- syncs obligations before fanout
- loads staff work from `JournalObligation`
- sends a direct CTA to the next exact action when present

Relevant files:
- [src/app/api/cron/mini-digest/route.ts](../../../src/app/api/cron/mini-digest/route.ts)
- [src/lib/telegram-obligation-digests.ts](../../../src/lib/telegram-obligation-digests.ts)
- [src/app/api/cron/mini-digest/route.test.ts](../../../src/app/api/cron/mini-digest/route.test.ts)

### AC4
`PASS`

Manager/root daily digests are now organization-backed and rerun-safe on normal reruns:
- manager summary built per organization
- manager/root sends carry org-aware delivery metadata
- sync, summary, and staff lookup failures are isolated so one bad org/user does not kill the whole cron

Relevant files:
- [src/app/api/cron/mini-digest/route.ts](../../../src/app/api/cron/mini-digest/route.ts)
- [src/app/api/cron/mini-digest/route.test.ts](../../../src/app/api/cron/mini-digest/route.test.ts)

### AC5
`PASS`

Fresh verification artifacts:
- tests: [raw/tests.txt](./raw/tests.txt)
- lint: [raw/lint.txt](./raw/lint.txt)
- tsc: [raw/tsc.txt](./raw/tsc.txt)
- build: [raw/build.txt](./raw/build.txt)

Command results:
- `node --import tsx --test src/lib/telegram-delivery-policy.test.ts src/lib/telegram-obligation-digests.test.ts src/app/api/cron/mini-digest/route.test.ts src/lib/journal-obligations.test.ts src/lib/bot/start-home.test.ts src/lib/bot/start-response.test.ts`
  - `33 pass, 0 fail`
- `npm run lint -- src/lib/telegram-delivery-policy.ts src/lib/telegram-delivery-policy.test.ts src/lib/telegram-obligation-digests.ts src/lib/telegram-obligation-digests.test.ts src/lib/telegram.ts src/app/api/cron/mini-digest/route.ts src/app/api/cron/mini-digest/route.test.ts`
  - `PASS`
- `npx tsc --noEmit --pretty false`
  - `PASS`
- `npm run build`
  - `PASS`

## Review loop

Fix-loop issues found and closed during verification:
- added structured `organizationId` metadata to `TelegramLog`
- isolated organization sync failures in cron
- isolated manager summary failures in cron
- isolated per-staff obligation lookup failures in cron
- escaped HTML-sensitive dynamic labels in digest bodies
- added legacy fallback in org-aware dedupe so post-deploy reruns still match older logs without `organizationId`

## Residual risk

Non-blocking:
- `skipOnRerun` is still best-effort under truly parallel cron invocations because delivery reservation is not atomic at the database level. This does not block current ACs, but it is the next hardening step if you want full parallel-run dedupe.
