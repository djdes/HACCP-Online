# intensive_cooling — external POST verification — 2026-04-15T17:35:01.836Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95e6005308tsyh6zs77o`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 20

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95e6005308tsyh6zs77o","entriesWritten":1,"createdDocument":false,"templateCode":"intensive_cooling"}
```

## Payload data shape sent
```json
{
  "productName": "Гуляш",
  "startTime": "12:00",
  "endTime": "13:30",
  "startTemp": 75,
  "endTemp": 4,
  "equipmentName": "Шкаф интенсивного охлаждения",
  "result": "pass"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
