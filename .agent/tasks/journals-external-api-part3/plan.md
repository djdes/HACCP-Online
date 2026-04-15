# External API verification — part 3

Goal: for each of 35 canonical journal codes, prove via actual HTTP exchange
that an external POST results in a persisted entry in prod DB, keep exactly
ONE verified `JournalDocument` per code in the test org, and archive real
curl + response pairs as evidence.

START at: 2026-04-13 (iteration 3)

## Process per code

1. Read source (`src/components/journals/<code>-document-client.tsx`, `src/lib/<code>-document.ts`).
2. Build realistic payload (not `{note: "smoke"}`).
3. POST against prod, capture `request.sh` (token masked) + `response.json`.
4. Query prod DB: confirm one `JournalDocumentEntry` exists with that payload under exactly one `JournalDocument` for this code in org `cmnm40ikt00002ktseet6fd5y`.
5. Delete any extra smoke-created documents for the same code in the same org.
6. Playwright screenshot for a sample of representative journals (budget-bound).
7. Write `evidence.md` with PASS/FAIL based on DB verification.

## Final

- Matrix in `FINAL.md`
- `problems.md` if any FAIL
- Tag `release-external-api-verified-v3-<ts>`
