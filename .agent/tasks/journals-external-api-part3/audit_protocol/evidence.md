# audit_protocol — external POST verification — 2026-04-15T17:35:01.128Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp94n2004008tsmx3vtmtd`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 28

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp94n2004008tsmx3vtmtd","entriesWritten":1,"createdDocument":false,"templateCode":"audit_protocol"}
```

## Payload data shape sent
```json
{
  "auditTopic": "Проверка соблюдения температурных режимов",
  "conductedAt": "2026-04-15",
  "auditor": "Технолог",
  "findings": "Незначительные отклонения не выявлены",
  "score": 95
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
