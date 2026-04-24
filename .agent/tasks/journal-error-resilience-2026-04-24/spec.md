# Journal Error Resilience

## Scope
Prevent journal pages from showing the generic "Что-то пошло не так" screen for the two production failure modes observed in PM2 logs:
- stale deployment/chunk/client-manifest mismatch after deploy;
- TasksFlow sync decrypt/config errors when integration encryption is unavailable or invalid.

## Acceptance Criteria
- AC1: Opening journal document pages must not auto-call TasksFlow when integration encryption is unavailable.
- AC2: TasksFlow pull/sync helpers must return safe reports instead of throwing into journal request/render paths.
- AC3: Cleaning journal manual TasksFlow refresh must show a toast error while leaving the journal usable.
- AC4: Deployment/chunk desync errors must trigger one hard reload before showing the generic app error screen.
- AC5: Targeted lint, TypeScript, production build, and crypto-missing smoke pass.
