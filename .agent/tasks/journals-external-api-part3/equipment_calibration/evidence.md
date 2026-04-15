# equipment_calibration — external POST verification — 2026-04-15T17:35:01.415Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrno0085ootsy941dzai`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 17

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrno0085ootsy941dzai","entriesWritten":1,"createdDocument":false,"templateCode":"equipment_calibration"}
```

## Payload data shape sent
```json
{
  "equipmentName": "Термогигрометр №1",
  "method": "Сличение с эталоном",
  "deviation": 0.3,
  "verdict": "Годен",
  "nextDate": "2027-04-13"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
