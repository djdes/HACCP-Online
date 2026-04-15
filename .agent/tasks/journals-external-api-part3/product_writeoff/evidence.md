# product_writeoff — external POST verification — 2026-04-15T17:35:02.006Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95o5005e08ts5dk4ckta`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 19

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95o5005e08ts5dk4ckta","entriesWritten":1,"createdDocument":false,"templateCode":"product_writeoff"}
```

## Payload data shape sent
```json
{
  "productName": "Молоко 3.2%",
  "quantity": 5,
  "unit": "л",
  "reason": "Истёк срок хранения",
  "commission": [
    "Управляющий",
    "Шеф-повар",
    "Кладовщик"
  ],
  "note": "Утилизация по акту"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
