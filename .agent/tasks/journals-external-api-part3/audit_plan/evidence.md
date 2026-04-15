# audit_plan — external POST verification — 2026-04-15T17:35:01.090Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp94lk003y08ts9qw0hpez`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 27

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp94lk003y08ts9qw0hpez","entriesWritten":1,"createdDocument":false,"templateCode":"audit_plan"}
```

## Payload data shape sent
```json
{
  "auditTopic": "Проверка процессов приёмки сырья",
  "scheduledAt": "2026-04-15",
  "auditor": "Технолог",
  "scope": "Склад, горячий цех"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
