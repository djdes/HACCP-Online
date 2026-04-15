# climate_control — external POST verification — 2026-04-15T17:35:01.304Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrlm0071ootsydcj5kn8`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 21

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrlm0071ootsydcj5kn8","entriesWritten":1,"createdDocument":false,"templateCode":"climate_control"}
```

## Payload data shape sent
```json
{
  "measurements": [
    {
      "time": "10:00",
      "temperature": 22.4,
      "humidity": 54
    },
    {
      "time": "17:00",
      "temperature": 23.1,
      "humidity": 56
    }
  ],
  "roomName": "Склад",
  "note": "Параметры в норме"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
