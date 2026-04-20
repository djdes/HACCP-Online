# Task Spec

- Task ID: `telegram-phase1-obligations-task6`
- Source plan: `docs/superpowers/plans/2026-04-20-telegram-bot-phase1-obligations.md`
- Scope: Task 6 only

## Goal

Make Telegram `/start` replies and the empty `/start` handler obligation-aware for phase 1, while keeping invite-token binding behavior compatible and all DM replies plain text.

## Files In Scope

- `src/lib/bot/start-response.ts`
- `src/lib/bot/start-response.test.ts`
- `src/lib/bot/handlers/start.ts`

## Acceptance Criteria

- AC1: `buildTelegramLinkedStartReply(...)` accepts the phase-1 linked-start state shape:
  - staff: `kind: "staff"` with `nextActionLabel`
  - manager: `kind: "manager"` with `pendingCount` and `employeesWithPending`
- AC2: Reply copy and button labels match phase-1 expectations:
  - staff with next action mentions it and uses `Открыть задачу`
  - staff without next action uses the completed-today message and `Открыть журналы`
  - manager includes summary counts and `Открыть кабинет`
  - missing button URL keeps the mini-app-not-configured fallback
- AC3: Empty `/start` routes through `loadTelegramStartHome(...)`, while the bind flow stays compatible and does not break the invite-token branch.
- AC4: Bot DM replies remain plain text and command registration stays untouched.
- AC5: Required verification passes:
  - `node --import tsx --test src/lib/bot/start-home.test.ts src/lib/bot/start-response.test.ts`
  - `npx tsc --noEmit --pretty false`

## Constraints

- Keep the diff tightly scoped to the owned files and Task 6 artifacts.
- Reuse `loadTelegramStartHome(...)` rather than duplicating linked-home decision logic.
- Do not redesign unrelated bot routing or command setup.
