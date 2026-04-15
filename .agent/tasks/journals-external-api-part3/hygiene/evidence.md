# hygiene — external POST verification — 2026-04-15T17:35:01.750Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrin000bootsej9rzpjo`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 22

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrin000bootsej9rzpjo","entriesWritten":1,"createdDocument":false,"templateCode":"hygiene"}
```

## Payload data shape sent
```json
{
  "status": "healthy",
  "temperatureAbove37": false
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
