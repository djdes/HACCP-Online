# perishable_rejection — external POST verification — 2026-04-15T17:35:01.924Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrms007loots94fafpxb`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 23

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrms007loots94fafpxb","entriesWritten":1,"createdDocument":false,"templateCode":"perishable_rejection"}
```

## Payload data shape sent
```json
{
  "productName": "Салат оливье",
  "quantity": 2,
  "unit": "кг",
  "reason": "Истёк срок хранения",
  "action": "утилизация",
  "result": "reject"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
