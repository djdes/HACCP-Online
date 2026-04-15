# accident_journal — external POST verification — 2026-04-15T17:35:01.052Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyp94j2003w08ts6pjlptf0`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 168

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyp94j2003w08ts6pjlptf0","entriesWritten":1,"createdDocument":false,"templateCode":"accident_journal"}
```

## Payload data shape sent
```json
{
  "happenedAt": "2026-04-15",
  "location": "Горячий цех",
  "description": "Поскользнулся на мокром полу",
  "injury": "Ушиб локтя",
  "firstAid": "Обработка, холодный компресс",
  "measures": "Установлен знак 'Осторожно, мокрый пол'"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
