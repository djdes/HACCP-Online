# training_plan — external POST verification — 2026-04-15T17:35:02.168Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95tk005l08tsbe69z9o9`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 22

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95tk005l08tsbe69z9o9","entriesWritten":1,"createdDocument":false,"templateCode":"training_plan"}
```

## Payload data shape sent
```json
{
  "topic": "Санитарные требования при обработке сырья",
  "scheduledAt": "2026-04-15",
  "durationHours": 2,
  "format": "очно",
  "note": "План на квартал"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
