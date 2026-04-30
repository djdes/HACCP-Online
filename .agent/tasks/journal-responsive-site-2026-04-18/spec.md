# Journal Responsive Site

## Summary

Fix the website journal/document surfaces so they remain usable on smaller
phones without asking the user follow-up questions.

## Observed Problems

- Document pages still overflow on smaller devices.
- Multiple journal document screens use rigid desktop-first action rows,
  large paddings, oversized headings, and fixed grid columns.
- Some tables must stay horizontally scrollable, but the surrounding shell
  should no longer waste width or force overflow earlier than necessary.

## Constraints

- Keep desktop layout quality intact.
- Prefer shared responsive rules over one-off patching.
- Do not rewrite every document client; target the highest-leverage shared
  surfaces and the most common journal document shells.

## Chosen Design

- Add a tiny shared responsive token module for journal/document UI shells.
- Apply it to:
  - common document list heading/actions/tabs
  - tracked document list cards
  - tracked document page shell, selection bar, toolbar, and dialogs
  - register document page shell, summary, toolbar, and dialogs
  - create/new journal form page shell
- On small screens:
  - headings shrink and take full width
  - primary/secondary actions stack cleanly
  - list cards collapse to one-column metadata blocks
  - shell paddings tighten
  - horizontal scrolling remains only on real data tables

## Acceptance Criteria

### AC1. Document list pages fit smaller devices better

- Journal document headings no longer reserve a fixed `70%` width on mobile.
- Action buttons stack or wrap without clipping.
- Journal tab rails remain reachable on small screens.
- Tracked document list rows collapse into a mobile-friendly stacked layout.

### AC2. Document page shells fit smaller devices better

- Common tracked/register document pages reduce outer padding and heading size
  on mobile.
- Sticky selection/action bars no longer overrun the viewport on narrow screens.
- Top action toolbars wrap or stack cleanly.

### AC3. Tables degrade gracefully instead of breaking the page

- Data tables still support horizontal scroll where needed.
- Surrounding cards/shells do not create avoidable overflow before the table.

### AC4. New entry form page fits smaller devices better

- The new journal entry page tightens hero/content spacing on small screens.
- Form container remains readable without horizontal clipping.

## Verification Plan

- Add red tests for the shared responsive token module.
- Run targeted tests including the new responsive test.
- Run targeted lint on touched files.
- Run `npx tsc --noEmit --pretty false`.
- Run `npm run build`.
