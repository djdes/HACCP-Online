# complaint_register — external POST verification — 2026-04-15T17:35:01.361Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp94xi004e08tsa8bnu76e`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 22

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp94xi004e08tsa8bnu76e","entriesWritten":1,"createdDocument":false,"templateCode":"complaint_register"}
```

## Payload data shape sent
```json
{
  "date": "2026-04-15",
  "source": "клиент",
  "content": "Жалоба на пересол блюда",
  "action": "Корректировка рецептуры",
  "responsible": "Шеф-повар",
  "resolved": true
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
