# pest_control — external POST verification — 2026-04-15T17:35:01.949Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp95kg005a08ts78esrwis`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 18

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp95kg005a08ts78esrwis","entriesWritten":1,"createdDocument":false,"templateCode":"pest_control"}
```

## Payload data shape sent
```json
{
  "area": "Склад",
  "treatmentType": "дератизация",
  "agent": "приманочная станция",
  "result": "следов вредителей не обнаружено",
  "performer": "ООО «СЭС-Сервис»"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
