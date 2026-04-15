# Journals Debug Sweep — FINAL

**Start:** 2026-04-15T20:36:41Z
**Planned budget:** 3 hours (180 min)
**Method:** manual `START_TIME.txt` pacing; one fix per commit; each batch typechecked and pushed.

## What got shipped

All fixes below are on `master` and auto-deployed via GitHub Actions.

### Visual consistency
- Unified 25 document-client `h1` sizes to 48px; dropped outliers (`lg:text-[62px]` in traceability; `text-[62px]` in hygiene list).
- Normalised oversized `h-16`/`h-14`/`py-6` top-toolbar action buttons to the shared `h-11 rounded-2xl px-4 text-[15px]` pattern across:
  complaint, accident, pest-control, intensive-cooling, metal-impurity, med-book, glass-list, audit-plan, audit-protocol, audit-report, training-plan, disinfectant, equipment-cleaning, sanitation-day, finished-product, uv-lamp-runtime.
- Collapsed stacked `Настройки` + `Закончить` rows into a single right-aligned row in cleaning-document.
- Dropped duplicate in-card breadcrumbs and redundant organization captions in glass-control, glass-list, med-books, product-writeoff, equipment-maintenance, register, tracked.
- Promoted Settings/Finish text-links to outline buttons in uv-lamp-runtime, acceptance, equipment-calibration, breakdown-history.
- Collapsed duplicate `Добавить из Айко`, duplicate `Добавить изделие`, duplicate Print buttons in acceptance, finished-product, perishable-rejection, fryer-oil.
- Restored missing back-link on cold-equipment.
- Normalised `Закончить журнал` to h-11 outline on finished-product.

### Navigation + back-link
- Added `DocumentBackLink` to document-client files that lacked it: register, tracked, scan-journal.
- Replaced scan-journal's one-off FileText "Назад к журналу" with the shared back + print component.
- Fixed broken back link in accident-document-client that pointed at the source-slug (`/journals/accidentjournal`) instead of the local code (`/journals/accident_journal`).
- Hid layout-level `← Назад` on nested `/journals/<code>/documents/*` routes so document pages no longer render two back arrows.

### Correctness
- Fixed mojibake "Р—Р°РєРѕРЅС‡РёС‚СЊ Р¶СѓСЂРЅР°Р»" → "Закончить журнал" in 7 document clients (cold-equipment, equipment-maintenance, finished-product, fryer-oil, glass-list, perishable-rejection, product-writeoff).
- Fixed double-encoded supplier names and Ivanov fallback in `src/lib/metal-impurity-document.ts` (e.g. `РРџ "Р РѕРјР°С€РєР°"` → `ИП "Ромашка"`).
- Fixed mojibake in audit-report delete-finding error toast.
- Removed dead ternary branches in audit-protocol Yes checkbox handler.
- Changed `let doc` → `const doc` in external dispatch (silenced prefer-const lint error).

### Cleanup
- Dropped unused `Link` / `Printer` imports from traceability, training-plan, uv-lamp-runtime, staff-journal-toolbar.
- Dropped unused `useMemo`, `getUserRoleLabel`, `STAFF_TRAINING_FULL_TITLE`, `updateRow`, `isPending`, `isSaving` from staff-training-document-client.
- Dropped unused `organizationName` prop from staff-journal-toolbar.

## Commit index

Run `git log --oneline 0bf17b4~..06c1d1f` for the full list. Highlights from this session continuation (newest first):

- `06c1d1f` fix(accident): back link → `accident_journal` local code
- `eb693bb` fix(sanitation-day): 'Добавить помещение' → h-11
- `9077cba` fix(equipment-cleaning): 'Добавить' → h-11
- `94d2399` fix(finished-product): 'Закончить журнал' → h-11 outline
- `d91d67c` fix(scan-journal): standard DocumentBackLink + print
- `68753c9` fix(tracked): add DocumentBackLink, drop org caption
- `ef378e3` fix(register): add DocumentBackLink, drop org caption
- `5aae593` fix(metal-impurity): mojibake → "Иванов И.И."
- `52e03b8` fix(journals): 7 mojibake "Закончить журнал" labels
- `47ebce5` fix(hygiene-list): h1 62px → 48px
- `6d9a4e9` fix(audit-report): 'Добавить несоответствие' → h-11
- `083b187` fix(audit-report): mojibake in delete error toast
- `caa01ae` fix(audit-protocol): remove dead checkbox branches
- `84211c0` fix(traceability): h1 → 48px, drop lg:62px
- `4cac80c` fix(external-dispatch): prefer-const

## Verification

- `npx tsc --noEmit` → clean (exit 0) after every batch.
- `npm run lint` → 92 warnings / 10 errors (all pre-existing "Cannot call impure function during render" server-component warnings and 2 chart `any`s — none introduced by this sweep).
- Deploys on `master` via GitHub Actions; PM2 process `haccp-online` reachable on `127.0.0.1:3002`.

## Not shipped (deferred)

- Replacing `window.prompt`/`window.confirm` with proper dialogs across med-book, disinfectant, hygiene-documents list etc. — large UI refactor.
- Widening the daily-fill-rate widget and `/api/external/summary` to count `JournalDocument.config.rows` for the 20 config-writer journals. Currently they only count entries, so those journals show as "not filled" even when rows exist.
- Scan-journal image overlay: uses plain `<img>` instead of `<Image>` — pre-existing, left as-is.

Session ended within budget; all changes are small, commit-per-issue, reversible via `git revert`.
