# med_books — external POST verification — 2026-04-15T17:35:01.862Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95ff005508tswjcps525`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 19

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95ff005508tswjcps525","entriesWritten":1,"createdDocument":false,"templateCode":"med_books"}
```

## Payload data shape sent
```json
{
  "employeeName": "Иванов И.И.",
  "medBookNumber": "МК-00123",
  "lastExam": "2026-01-15",
  "nextExam": "2026-07-15",
  "vaccinations": [
    {
      "name": "Дифтерия",
      "status": "done",
      "date": "2025-03-10"
    },
    {
      "name": "Гепатит А",
      "status": "done",
      "date": "2025-06-20"
    }
  ],
  "note": "Медосмотр пройден"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
