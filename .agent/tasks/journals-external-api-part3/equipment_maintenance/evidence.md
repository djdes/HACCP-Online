# equipment_maintenance — external POST verification — 2026-04-15T17:35:01.479Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrnk0083oots27zzxlrl`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 24

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrnk0083oots27zzxlrl","entriesWritten":1,"createdDocument":false,"templateCode":"equipment_maintenance"}
```

## Payload data shape sent
```json
{
  "equipmentName": "Пароконвектомат №1",
  "workType": "Плановое ТО",
  "result": "Исправно",
  "technician": "Сервис-инженер",
  "note": "Следующее ТО — через 3 мес."
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
