# incoming_control — external POST verification — 2026-04-15T17:35:01.783Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95c2004z08tsl13qn8oc`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 26

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95c2004z08tsl13qn8oc","entriesWritten":1,"createdDocument":false,"templateCode":"incoming_control"}
```

## Payload data shape sent
```json
{
  "supplier": "ООО «Мясокомбинат»",
  "productName": "Курица охлаждённая",
  "quantity": 15,
  "unit": "кг",
  "temperature": 2.5,
  "packageOk": true,
  "docsOk": true,
  "result": "pass",
  "note": "Приёмка разрешена"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
