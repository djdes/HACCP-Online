# glass_control — external POST verification — 2026-04-15T17:35:01.655Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrp0008jootso4d26bvc`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 23

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrp0008jootso4d26bvc","entriesWritten":1,"createdDocument":false,"templateCode":"glass_control"}
```

## Payload data shape sent
```json
{
  "area": "Горячий цех",
  "result": "целостно",
  "checkedItems": 7,
  "damaged": 0,
  "note": "Визуальный осмотр без замечаний"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
