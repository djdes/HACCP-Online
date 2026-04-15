# cold_equipment_control — external POST verification — 2026-04-15T17:35:01.332Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrls0075ootsr9y7prhz`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 21

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrls0075ootsr9y7prhz","entriesWritten":1,"createdDocument":false,"templateCode":"cold_equipment_control"}
```

## Payload data shape sent
```json
{
  "readings": [
    {
      "equipmentName": "Холодильник №1",
      "temperature": 3.5,
      "time": "08:00"
    },
    {
      "equipmentName": "Морозильник №1",
      "temperature": -18.2,
      "time": "08:00"
    }
  ],
  "note": "Показания в норме"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
