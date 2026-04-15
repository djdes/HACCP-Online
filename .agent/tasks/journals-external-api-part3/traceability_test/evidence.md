# traceability_test — external POST verification — 2026-04-15T17:35:02.136Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95s3005j08tsxbo6zjmk`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 25

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95s3005j08tsxbo6zjmk","entriesWritten":1,"createdDocument":false,"templateCode":"traceability_test"}
```

## Payload data shape sent
```json
{
  "batchCode": "BATCH-2026-04-0001",
  "productName": "Суп куриный",
  "supplierChain": [
    "ООО «Мясокомбинат»",
    "ООО «Овощебаза»"
  ],
  "result": "пройдено",
  "note": "Прослеживаемость восстановлена за 15 минут"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
