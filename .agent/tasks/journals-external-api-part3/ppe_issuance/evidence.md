# ppe_issuance — external POST verification — 2026-04-15T17:35:01.975Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrnq0086ootsb9cbr7tu`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 18

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrnq0086ootsb9cbr7tu","entriesWritten":1,"createdDocument":false,"templateCode":"ppe_issuance"}
```

## Payload data shape sent
```json
{
  "employeeName": "Иванов И.И.",
  "ppeType": "Перчатки нитриловые",
  "quantity": 2,
  "unit": "пара",
  "signed": true
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
