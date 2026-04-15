# fryer_oil — external POST verification — 2026-04-15T17:35:01.553Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrmx007nootso6dbqpof`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 24

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrmx007nootso6dbqpof","entriesWritten":1,"createdDocument":false,"templateCode":"fryer_oil"}
```

## Payload data shape sent
```json
{
  "tpm": 18,
  "qualityScore": 3,
  "action": "continue",
  "equipment": "Фритюрница №1",
  "oilType": "Подсолнечное",
  "productType": "Картофель фри",
  "note": "TPM в пределах нормы"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
