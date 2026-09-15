# journal-responsibles-org-2026-09: open items (verifier round 2, 2026-09-15)

Local verdict: **PASS** for AC1–AC10. There are no code problems left: both round-1 failures are fixed and re-proven.
- **AC3:** P6 reproduction and P8/P9 probes pass; the dated spec clarification is judged legitimate.
- **AC8:** P1/P2 probes and new e2e checks pass; the new AST guard fails on HEAD and passes on the working tree.

Overall stays **UNKNOWN** only because of the production criterion below. Details are in `verdict.json`.

---

## AC11: production diagnostics

**Criterion text.** "Прод: только read-only диагностика и dry-run; `--apply` — после явного «ок» владельца и бэкапа."

**Status:** UNKNOWN

**Why it is not proven.** The criterion is production-only. The verifier must not touch production, and the evidence
bundle contains no production output.

**Minimal reproduction / how to prove**
1. After deploy, on production, run read-only: `npx tsx scripts/repair-journal-responsibles.ts <owner email|orgId>` (no
   flags). The report and the "Найдено (исправится при --apply)" counters are printed; nothing is written.
2. Attach that output to `raw/` (for example `raw/prod-repair-dry-run.txt`).
3. Only after the owner's explicit OK and a backup
   (`pg_dump -t '"JournalDocument"' -t '"JournalDocumentEntry"'`): run with `--apply` and attach the output.

**Expected vs actual.** Expected: the production dry-run report, plus proof of backup and owner OK before any `--apply`.
Actual: nothing to verify yet.

**Affected files:** `scripts/repair-journal-responsibles.ts` (no code change needed).

**Smallest safe fix:** none in code. Collect the production dry-run output as evidence.

**Corrective hint.** Run only the dry-run on production and save its output. `--apply` waits for the owner's
explicit OK and a fresh backup.
