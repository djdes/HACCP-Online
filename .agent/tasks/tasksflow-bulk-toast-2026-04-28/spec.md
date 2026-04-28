# TasksFlow Bulk Assign Toast Fix

## Context

The dashboard bulk assign button can return `created: 0` with a positive
`alreadyLinked` value when the manager clicks it after tasks were already
created. The current client toast still says "Задачи отправлены", which is
misleading because no new tasks were sent.

## Acceptance Criteria

AC1. When `created > 0`, the toast may say that tasks were sent and include
created/already-linked/skipped/error/document counts.

AC2. When `created === 0` and `alreadyLinked > 0`, the toast must not say that
tasks were sent. It must clearly say that there are no new tasks and show the
already-assigned count.

AC3. When all counters are zero, the current skip-reason/message behavior stays
intact.

AC4. Formatting logic is covered by focused unit tests.

AC5. Existing TasksFlow bulk-assign selection tests still pass.
