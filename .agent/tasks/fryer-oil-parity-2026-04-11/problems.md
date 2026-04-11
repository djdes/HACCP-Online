# Problems: fryer-oil-parity-2026-04-11

## Verification failure

Fresh verifier reported `FAIL` for the current task state.

## Verified problems

1. `AC8` was not compliant with the frozen spec because evidence marked the task as `PASS WITH LIMITS` / `pass_with_limits` instead of strict `PASS`.
2. `AC1` and `AC2` lacked fresh current-state runtime proof for visual parity after the code changes.
3. `AC6` lacked fresh current-state proof that fryer-oil print opens an actual PDF response consistent with the fryer-oil table structure.

## Smallest safe fix plan

1. Collect fresh runtime evidence from the deployed application after pushing the fryer-oil changes.
2. Confirm working login/access for a test account on the deployed environment.
3. Capture fryer-oil list and document screenshots from the deployed app.
4. Confirm fryer-oil print returns `application/pdf` and ties back to the fryer-oil PDF/table implementation.
5. Update `evidence.md` and `evidence.json` to strict `PASS` only after the fresh artifacts exist.
6. Run a fresh verification pass again.
