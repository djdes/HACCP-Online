# journals-buttons-verify

## Goal
Recheck journal detail-page buttons across all 35 production journal types after external API verification changes.

## Scope
- Use the already verified production documents from `.agent/tasks/journals-external-api-part2/*/evidence.json`.
- Open each `/journals/<code>/documents/<docId>` as `admin@haccp.local`.
- Verify all visible top-level journal action buttons that are safe to exercise automatically:
  - `Печать`
  - settings buttons (`Настройки*`, `Настроить*`)
  - add buttons (`Добавить*`)
  - `Редактировать список изделий`
  - `Закончить журнал` only up to opening and dismissing the confirm dialog
  - top-level `Сохранить` buttons when present with unchanged data
- Record disabled buttons separately; do not treat correctly disabled actions as failures.
- Do not confirm destructive actions such as final delete/close submits.

## Acceptance Criteria
- `AC1`: All 35 journal detail pages open successfully on production with authenticated session.
- `AC2`: Every visible safe top-level action button on each page can be exercised without navigation breakage, uncaught page errors, or stuck dialogs.
- `AC3`: `Печать` succeeds for every checked document with HTTP 200 and PDF content.
- `AC4`: Evidence is written to `.agent/tasks/journals-buttons-verify/evidence.md`, `.agent/tasks/journals-buttons-verify/evidence.json`, and raw per-code artifacts.
- `AC5`: If any button fails, the evidence names the journal, button label, and concrete repro result.
