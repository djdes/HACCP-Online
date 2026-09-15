# org-short-name-2026-09: verifier problems (round 2)

Re-verified on 2026-09-15 against the current working tree. Database: `localhost:5432/wesetup_e2e`. Dev server: `:3020`.

Both round 1 failures are fixed and now pass:
- **AC3:** the paper blank page header shows the short name, matching its PDF.
- **AC6:** a document title set in the header now prints in the `cleaning_ventilation_checklist` and `sanitary_day_control` PDFs.

Current results: typecheck exits 0, `test:gate` passes 1281 with 0 failures, e2e passes 55/55, and the verifier probe passes 28/28. AC1–AC6 are PASS.

Only one item remains open.

## AC7: UNKNOWN

**Criterion:** typecheck, lint and tests are clean; e2e runs locally; production gets a read-only check (form and header).

**Status:** UNKNOWN. The local part passes: typecheck exits 0, ESLint reports 0 errors (the 12 warnings already exist at HEAD), unit tests pass 17/17, `test:gate` passes 1281 with 0 failures, and e2e passes 55/55.

**Why it is not proven:** The production read-only check can only run after deploy, and the verifier must not contact production.

**Reproduction:** After deploy, read-only:
1. Open `/settings/organization` on production and confirm the «Сокращённое название для журналов» field is there.
2. Open any journal document and confirm the header shows the resolved name.

**Expected:** Both are visible on production.
**Actual:** Not deployed yet.

**Affected files:** None.

**Smallest safe fix:** No code change. Deploy, then run the read-only production check and record it in evidence.md and evidence.json.

**Hint:** Only read pages on production. Do not save the form or edit headers there, because that would change real data.
