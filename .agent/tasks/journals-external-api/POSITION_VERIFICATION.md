# Position source-of-truth verification — 2026-04-12

## Setup

Two users on the test organisation `cmnm40ikt00002ktseet6fd5y` got a
`positionTitle` assigned via direct SQL (settings UI does this via the
new input field):

| id | name | role | positionTitle |
|---|---|---|---|
| cmnq1elvh00000wtsr54w66fw | Петров П.П. | technologist | Су-шеф горячего цеха |
| cmnq1enza00040wts1fx03ms0 | Кузнецова К.К. | operator (→cook) | Повар холодного цеха |

## Attack request

The employee-app posts a journal row with deliberately wrong staff fields:

```json
{
  "journalCode": "incoming_control",
  "employeeId": "cmnq1enza00040wts1fx03ms0",
  "data": {
    "positionTitle": "SHOULD_BE_OVERWRITTEN",
    "employeeName": "SHOULD_BE_OVERWRITTEN",
    ...
  }
}
```

## Server response

```json
{"ok":true,"documentId":"cmnw679tc002bz4ts3fe5s43b","entriesWritten":1,...}
```

## DB read-back

```
cmnw6lweh000eeqtss9bb9zwb | Повар холодного цеха | Кузнецова К.К.
```

`reconcileEntryStaffFields` rewrote both `positionTitle` and `employeeName`
to the values from the `User` record. The same employee will therefore show
up identically in every journal — the "Повар в одном журнале, Официант в
другом" drift is no longer possible unless the admin actively edits the
user record.

## Verdict

PASS — `User.positionTitle` is now the authoritative display title across
all journal renders and external POSTs.
