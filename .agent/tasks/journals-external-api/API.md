# HACCP-Online External Entries API

Base URL: `https://wesetup.ru`

## Healthcheck

`GET /api/external/healthz` — anonymous, returns the build sha/time and DB
status. Call this on startup before issuing any POSTs:

```json
{
  "ok": true,
  "build": { "sha": "abc1234", "time": "2026-04-16T08:00:00Z" },
  "db": { "reachable": true, "journalTemplates": 35 },
  "latencyMs": 14,
  "now": "2026-04-16T08:03:11.000Z"
}
```

## Auth

All write requests require `Authorization: Bearer <token>`.

Token resolution order:

| Mode | Token source | Organisation scope |
|---|---|---|
| **Per-org** (recommended) | `Organization.externalApiToken` column | Pinned to that org — the payload's `organizationId` is ignored. |
| Shared app | `EXTERNAL_API_TOKEN` env | Any org the payload names. |
| Sensor | `SENSOR_API_TOKEN` env | Any org the payload names. |

Per-org tokens are the safe default: even if a token leaks, the attacker
cannot write into a different tenant.

## Idempotency

Include `Idempotency-Key: <opaque-string>` on retries. The server caches
the first 200 response for each `(token, key)` and replays it on repeat —
no double-writes. Keys should be ≤120 characters and unique per logical
operation (UUID works).

Replayed responses include header `idempotent-replayed: true`.

## Endpoint

`POST /api/external/entries`

## Request Body

Preferred single-row form:

```json
{
  "organizationId": "cmnm40ikt00002ktseet6fd5y",
  "journalCode": "hygiene",
  "date": "2026-04-12",
  "employeeId": "cm...",
  "source": "employee_app",
  "rows": { "status": "healthy", "temperatureAbove37": false }
}
```

- `organizationId`: target organization.
- `journalCode`: template code.
- `date`: optional day in `YYYY-MM-DD`.
- `employeeId`: optional employee/cell owner.
- `source`: optional enum: `employee_app`, `sensor`, `manual`.
- `rows`: preferred payload field. Can be an object, array of row objects, or array of `{ employeeId, date, data }`.

Backward-compatible aliases:

- `data`: accepted for legacy single-row callers.
- `entries`: accepted for legacy batch callers.

Preferred batch form:

```json
{
  "organizationId": "cmnm40ikt00002ktseet6fd5y",
  "journalCode": "climate_control",
  "rows": [
    { "employeeId": "cm...", "date": "2026-04-12", "data": { "temp": 22 } },
    { "employeeId": "cm...", "date": "2026-04-12", "data": { "temp": 23 } }
  ]
}
```

## Response

Success (`200`):

```json
{
  "ok": true,
  "documentId": "cmn...",
  "entriesWritten": 1,
  "createdDocument": false,
  "templateCode": "hygiene"
}
```

Notes:

- `createdDocument: true` means the API created a new active `JournalDocument` covering the month that contains `date`.
- `entriesWritten` is the number of `JournalDocumentEntry` rows upserted.

## Errors

| Status | Meaning |
|---:|---|
| `400` | Invalid JSON or invalid payload |
| `401` | Missing or invalid bearer token |
| `404` | Unknown organization, template code, or employee |
| `503` | Server token(s) not configured |

Every request is logged to `JournalExternalLog`. Only a masked `tokenHint` is stored.

## Curl Examples

Hygiene:

```bash
curl -X POST https://wesetup.ru/api/external/entries \
  -H "authorization: Bearer $EXTERNAL_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "organizationId": "cmnm40ikt00002ktseet6fd5y",
    "journalCode": "hygiene",
    "date": "2026-04-12",
    "rows": { "status": "healthy", "temperatureAbove37": false }
  }'
```

Climate sensor:

```bash
curl -X POST https://wesetup.ru/api/external/entries \
  -H "authorization: Bearer $SENSOR_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "organizationId": "cmnm40ikt00002ktseet6fd5y",
    "journalCode": "climate_control",
    "source": "sensor",
    "rows": { "temp": 22.4, "humidity": 54 }
  }'
```

Cold equipment sensor:

```bash
curl -X POST https://wesetup.ru/api/external/entries \
  -H "authorization: Bearer $SENSOR_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "organizationId": "cmnm40ikt00002ktseet6fd5y",
    "journalCode": "cold_equipment_control",
    "source": "sensor",
    "rows": { "readings": [{ "equipmentName": "Холодильник 1", "temp": 3.2 }] }
  }'
```

## Integrator Notes

- The API upserts by `(documentId, employeeId, date)`.
- Reposting the same `(journalCode, employeeId, date)` overwrites the same cell payload.
- Staff-facing fields inside payload data are reconciled from the `User` record, so the client should not hardcode `positionTitle` or similar display labels.
- `/api/journal-documents/<id>/pdf` is session-gated for the web UI and is not part of the bearer-token external contract.
