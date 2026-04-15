# metal_impurity — external POST verification — 2026-04-15T17:35:01.892Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodror008eoots6d8r4koo`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 21

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodror008eoots6d8r4koo","entriesWritten":1,"createdDocument":false,"templateCode":"metal_impurity"}
```

## Payload data shape sent
```json
{
  "rawMaterial": "Мука пшеничная",
  "supplier": "ООО «Мукомол»",
  "quantity": 50,
  "unit": "кг",
  "detectorStatus": "работает",
  "result": "примесей не обнаружено"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
