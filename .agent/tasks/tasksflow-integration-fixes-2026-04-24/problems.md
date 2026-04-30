# Problems

## Fixed During Task

- TasksFlow settings UI could show a raw JSON parse error when API returned HTML, redirect, or non-JSON body.
- Settings/API routes used page auth redirects for fetch callers, producing login HTML instead of JSON errors.
- `complaint_register` had a specific adapter file but was not registered, so TasksFlow used generic fallback.
- `/staff` URL returned 404 even though users naturally expect it to open the staff section.

## Remaining Follow-Ups

- React hydration warnings appear on some dashboard/journals/users flows. The concrete browser warning mentions nested `<button>` markup; this should be audited in journal cards and shared navigation/components.
- Full Telegram Mini App behavior was not tested because local browser lacks Telegram `initData`.
- TasksFlow still has generic fallback for `fryer_oil`, `med_books`, `sanitary_day_control`, and `glass_control`; this is acceptable only if free-text completion is enough.
