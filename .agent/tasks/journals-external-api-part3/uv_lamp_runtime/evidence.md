# uv_lamp_runtime — external POST verification — 2026-04-15T17:35:02.201Z

- HTTP: **200**
- ok: **true**
- documentId: `cmnyodrmj007eootszhwxywvm`
- entriesWritten: **1**
- createdDocument: false
- elapsedMs: 21

## Request
```bash
$ bash request.sh
```

## Response (verbatim)
```json
{"ok":true,"documentId":"cmnyodrmj007eootszhwxywvm","entriesWritten":1,"createdDocument":false,"templateCode":"uv_lamp_runtime"}
```

## Payload data shape sent
```json
{
  "runtimeMinutes": 30,
  "status": "ok",
  "lampId": "uv-1",
  "note": "Лампа отработала плановый цикл"
}
```

## Verdict
PASS (HTTP layer)

> DB-residue verification lives in `_summary/db-verification.md` — it reads
> the prod `JournalDocumentEntry` row for this documentId and confirms the
> `data` column equals the payload above.
