# Problems

This task hit a verification fix-loop and is now reverified.

## Resolved during the loop

1. `TelegramLog` lacked structured organization metadata for digest dedupe.
   Fixed by adding `organizationId` to `TelegramLog`, threading it through Telegram send helpers, and querying it in the delivery policy with legacy fallback for older rows that were written before this field existed.

2. `/api/cron/mini-digest` could still fail whole-run on one bad organization.
   Fixed by isolating:
   - organization sync failures
   - manager summary failures
   - per-staff obligation lookup failures

3. Digest bodies injected raw dynamic labels into Telegram HTML messages.
   Fixed by escaping dynamic staff names, organization names, journal names, and descriptions in digest builders.

## Remaining non-blocking risk

- `skipOnRerun` is still best-effort under truly parallel cron invocations because there is no atomic reservation / unique delivery lock on `(userId, organizationId, kind, dedupeKey)`. Current acceptance criteria still pass, but this is the next hardening step if you want parallel-run dedupe to be silicon-grade instead of merely anti-spam enough for normal reruns.
