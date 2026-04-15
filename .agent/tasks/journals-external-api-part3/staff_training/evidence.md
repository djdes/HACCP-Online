# staff_training — external POST verification — 2026-04-15T17:35:02.093Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrnb007zootsdgu2bhje`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 29

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrnb007zootsdgu2bhje","entriesWritten":1,"createdDocument":false,"templateCode":"staff_training"}
```

## Payload data shape sent
```json
{
  "topic": "Входной инструктаж по СанПиН",
  "trainerName": "Шеф-повар",
  "durationHours": 1,
  "trainees": [
    "Иванов И.И.",
    "Петров П.П."
  ],
  "signed": true,
  "note": "Инструктаж проведён"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
