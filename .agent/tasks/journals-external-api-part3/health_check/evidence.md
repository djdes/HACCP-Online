# health_check — external POST verification — 2026-04-15T17:35:01.721Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrkc003oootsj2l9i45m`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 21

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrkc003oootsj2l9i45m","entriesWritten":1,"createdDocument":false,"templateCode":"health_check"}
```

## Payload data shape sent
```json
{
  "signed": true,
  "measures": "Осмотр проведён, здоров"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
