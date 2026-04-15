# cleaning_ventilation_checklist — external POST verification — 2026-04-15T17:35:01.275Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrp8008ooots0ldi7hs4`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 20

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrp8008ooots0ldi7hs4","entriesWritten":1,"createdDocument":false,"templateCode":"cleaning_ventilation_checklist"}
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
