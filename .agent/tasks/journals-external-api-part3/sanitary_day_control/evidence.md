# sanitary_day_control — external POST verification — 2026-04-15T17:35:02.049Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95pf005g08ts91ywlypt`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 19

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95pf005g08ts91ywlypt","entriesWritten":1,"createdDocument":false,"templateCode":"sanitary_day_control"}
```

## Payload data shape sent
```json
{
  "done": true,
  "performer": "Повар горячего цеха",
  "note": "Уборка выполнена по графику"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
