# Evidence

- Command: `node --import tsx --test src/lib/bot/start-home.test.ts src/lib/bot/start-response.test.ts`
  - Result: PASS
  - Raw: `.agent/tasks/telegram-phase1-obligations-task6/raw/start-tests.txt`
- Command: `npx tsc --noEmit --pretty false`
  - Result: PASS
  - Raw: `.agent/tasks/telegram-phase1-obligations-task6/raw/tsc.txt`

## Acceptance Criteria

- AC1: PASS - `buildTelegramLinkedStartReply(...)` accepts the phase-1 staff and manager state variants.
- AC2: PASS - staff next-action, staff completed-today, manager summary, and no-mini-app fallback copy/button labels all match Task 6 expectations.
- AC3: PASS - empty `/start` now routes through `loadTelegramStartHome(...)`, and the invite-token bind flow reuses the same linked-home path after a successful bind.
- AC4: PASS - all DM replies remain plain text and command registration was left untouched.
- AC5: PASS - required `start-home` + `start-response` tests and `tsc` verification both passed.
