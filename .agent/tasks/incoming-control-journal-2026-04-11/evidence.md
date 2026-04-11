# Evidence: incoming-control-journal-2026-04-11

## Summary

Fresh verification is now `PASS`.

- `incoming_control` routes to a dedicated document-list flow and auto-seeds active/closed DB-backed demo documents when missing: [page.tsx](/c:/www/Wesetup.ru/src/app/(dashboard)/journals/[code]/page.tsx:2400)
- The list page matches the screenshoted document shell with active/closed tabs, create/settings/print/delete actions, and responsible/date metadata: [incoming-control-documents-client.tsx](/c:/www/Wesetup.ru/src/components/journals/incoming-control-documents-client.tsx:418)
- The document detail page now satisfies the frozen acceptance contract for split manufacturer/supplier columns, explicit confirm/import/bulk-add dialogs, list editor parity, and file-import UX: [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:658)

## Commands

### 1. TypeScript verification

Command:

```powershell
npx tsc --noEmit
```

Result:
- PASS
- Raw log: [tsc.log](/c:/www/Wesetup.ru/.agent/tasks/incoming-control-journal-2026-04-11/raw/tsc.log)

### 2. Production build verification

Command:

```powershell
npm run build
```

Result:
- PASS
- Raw log: [build.log](/c:/www/Wesetup.ru/.agent/tasks/incoming-control-journal-2026-04-11/raw/build.log)

## Acceptance criteria status

- `AC1` PASS: existing `incoming_control` is the journal used for this task and is routed into the dedicated document-based page instead of the generic tracked-documents shell. See [page.tsx](/c:/www/Wesetup.ru/src/app/(dashboard)/journals/[code]/page.tsx:2452) and [acceptance-document.ts](/c:/www/Wesetup.ru/src/lib/acceptance-document.ts:3).
- `AC2` PASS: the list page renders active/closed tabs, create/settings/print/delete actions, and responsible/start-date metadata for persisted documents. See [incoming-control-documents-client.tsx](/c:/www/Wesetup.ru/src/components/journals/incoming-control-documents-client.tsx:418).
- `AC3` PASS: the opened document shows the HACCP header block, main action row, print entry path, and finish journal flow. See [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:1304).
- `AC4` PASS: the table now exposes separate `Производитель` and `Поставщик` columns plus selection toolbar behavior for editable documents. See [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:1279) and [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:1382).
- `AC5` PASS: create/settings support title, start date, expiry-field label radio, responsible title, and employee persistence. See [incoming-control-documents-client.tsx](/c:/www/Wesetup.ru/src/components/journals/incoming-control-documents-client.tsx:559) and [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:778).
- `AC6` PASS: add/edit row dialog includes date/time, product/manufacturer/supplier with add-new flows, three binary groups, expiry date/time, note, responsible title, and employee. See [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:191).
- `AC7` PASS: the dedicated list editor covers products, manufacturers, and suppliers and includes visible file-import help plus dropzone import affordances. See [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:501) and [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:658).
- `AC8` PASS: row import now uses an explicit Excel modal with documented column contract, dropzone UI, template download, strict mapping, and visible error handling. See [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:868) and [acceptance-document-client.tsx](/c:/www/Wesetup.ru/src/components/journals/acceptance-document-client.tsx:1194).
- `AC9` PASS: documents/settings/rows remain DB-backed and seeded from current org products, batches, and users when needed. See [page.tsx](/c:/www/Wesetup.ru/src/app/(dashboard)/journals/[code]/page.tsx:2400) and [acceptance-document.ts](/c:/www/Wesetup.ru/src/lib/acceptance-document.ts:239).
- `AC10` PASS: verification was rerun on the current working tree and both `tsc` and production build passed. See the command section and raw logs above.

## Verdict

PASS
