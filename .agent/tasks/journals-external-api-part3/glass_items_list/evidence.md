# glass_items_list — external POST verification — 2026-04-15T17:35:01.685Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp958v004t08tsn1jgqsid`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 21

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp958v004t08tsn1jgqsid","entriesWritten":1,"createdDocument":false,"templateCode":"glass_items_list"}
```

## Payload data shape sent
```json
{
  "items": [
    {
      "name": "Стеклянная банка",
      "area": "Склад",
      "count": 5
    },
    {
      "name": "Мерный стакан",
      "area": "Горячий цех",
      "count": 2
    }
  ],
  "note": "Перечень актуализирован"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
