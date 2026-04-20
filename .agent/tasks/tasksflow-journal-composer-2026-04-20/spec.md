# TasksFlow Journal Composer

## Goal
Упростить журнальный режим создания задачи в `TasksFlow`:
- длинная форма должна раскрываться по шагам, а не тянуться бесконечной простынёй;
- после выбора журнала интерфейс должен подхватывать журнал-специфичные подписи, подсказки и CTA;
- доступные документы и строки выбранного журнала должны показываться в более удобном виде.

## Scope
- `C:\www\TasksFlow\client\src\pages\CreateTask.tsx`
- `C:\www\TasksFlow\shared\wesetup-journal-mode.ts`
- `C:\www\TasksFlow\tests\wesetup-journal-mode.test.ts`
- `C:\www\Wesetup.ru\src\app\api\integrations\tasksflow\journals-catalog\route.ts`
- new helper(s) in `C:\www\Wesetup.ru\src\lib\` if needed for journal UI metadata
- test(s) for new WeSetup helper(s)

## Design
1. WeSetup catalog returns optional `ui` metadata per journal:
   - labels for row/document/assignee/title fields
   - placeholders and helper text
   - action wording for submit/preview
   - section titles for row mode vs free mode
2. TasksFlow treats journal mode as a 3-step composer:
   - step 1: choose journal
   - step 2: choose mode and fill only relevant fields
   - step 3: review summary and submit
3. Step panels are collapsible and auto-focus the current stage so the admin does not need to scroll through every block at once.
4. Rows are shown in document-grouped collapsible lists inside the selected journal so large journals stay manageable.

## Acceptance Criteria
- AC1: In journal mode, the create-task page uses collapsible sections so only the current step stays expanded by default.
- AC2: Choosing a journal updates labels/placeholders/helper copy from journal-specific metadata, with sensible fallback for journals without custom wording.
- AC3: For row-backed journals, rows are displayed in a more compact grouped flow that reduces page length and still supports search + selection.
- AC4: For free-task journals, the form still supports any journal/document, but wording and preview text reflect the chosen journal.
- AC5: Targeted verification passes:
  - `TasksFlow`: relevant tests and build
  - `Wesetup.ru`: relevant tests and typecheck for touched helper/API code

## Non-Goals
- no push to remote
- no redesign of free task mode outside journal workflow
- no change to existing bind API semantics
