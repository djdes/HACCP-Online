# TasksFlow selected journals bulk assign

## Goal

Make the dashboard and TasksFlow bulk assignment use the journals selected in organization journal settings, not the old hard-coded daily subset.

## Acceptance Criteria

1. The dashboard "today" compliance count is based on every enabled active journal template, so if 35 journals are selected the required count is 35.
2. The bulk assign API targets every enabled unfilled selected journal, not only `ALL_DAILY_JOURNAL_CODES`.
3. Journals that require per-employee completion can still create multiple TasksFlow tasks, but normal journal-per-day templates create at most one TasksFlow task per journal document.
4. Bulk assignment respects manager journal permissions from the staff hierarchy settings.
5. If hierarchy/schedule/user-link data is missing or invalid for a journal, the API skips that journal instead of sending duplicate or partial tasks.
6. Skipped journals create a WeSetup bell notification for management with a link to staff hierarchy settings.
7. Changes are covered by focused unit tests and type/lint checks.
