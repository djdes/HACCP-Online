# finished_product — external POST verification — 2026-04-15T17:35:01.513Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrmp007kootse49o6gwn`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 26

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrmp007kootse49o6gwn","entriesWritten":1,"createdDocument":false,"templateCode":"finished_product"}
```

## Payload data shape sent
```json
{
  "productName": "Суп куриный с лапшой",
  "quantity": 10,
  "unit": "л",
  "organoleptic": "Запах, вкус, цвет в норме",
  "result": "pass",
  "note": "Партия к реализации допущена"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
