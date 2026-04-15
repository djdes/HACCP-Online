# audit_report — external POST verification — 2026-04-15T17:35:01.167Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp94oa004208tsxq9zndq0`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 31

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp94oa004208tsxq9zndq0","entriesWritten":1,"createdDocument":false,"templateCode":"audit_report"}
```

## Payload data shape sent
```json
{
  "reportPeriod": "2026-04",
  "summary": "За период нарушений не выявлено",
  "nonconformities": 0,
  "recommendations": "Провести плановое обучение в следующем квартале"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
