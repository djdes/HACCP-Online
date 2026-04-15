# disinfectant_usage — external POST verification — 2026-04-15T17:35:01.390Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp94yo004g08tspxoi4695`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 20

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp94yo004g08tspxoi4695","entriesWritten":1,"createdDocument":false,"templateCode":"disinfectant_usage"}
```

## Payload data shape sent
```json
{
  "productName": "Септабик",
  "concentration": "0.1%",
  "volumeLiters": 5,
  "area": "Горячий цех",
  "purpose": "Дезинфекция поверхностей",
  "note": "Применено по инструкции"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
