# breakdown_history — external POST verification — 2026-04-15T17:35:01.198Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp94q6004408ts4p69yswq`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 23

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp94q6004408ts4p69yswq","entriesWritten":1,"createdDocument":false,"templateCode":"breakdown_history"}
```

## Payload data shape sent
```json
{
  "equipmentName": "Холодильник №1",
  "breakdownType": "Утечка хладагента",
  "repairAction": "Заменён компрессор",
  "downtimeHours": 4,
  "cost": 12000,
  "note": "Восстановлено в срок"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
