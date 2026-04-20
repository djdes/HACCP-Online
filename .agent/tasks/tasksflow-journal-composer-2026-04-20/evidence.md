# Evidence

## Acceptance Criteria

- AC1 `PASS`
  Журнальный режим в `TasksFlow` разбит на сворачиваемые шаги: выбор журнала, настройка задачи, проверка перед созданием.

- AC2 `PASS`
  `Wesetup` каталог теперь отдает `ui`-метаданные по журналу, а `TasksFlow` подхватывает журнал-специфичные лейблы, плейсхолдеры и CTA.

- AC3 `PASS`
  Для журналов со строками список строк сгруппирован по документам и показывается в раскрывающихся блоках, что убирает длинный непрерывный список.

- AC4 `PASS`
  Для свободных журнальных задач форма и превью используют текст из выбранного журнала и сохраняют выбор любого журнала/документа/сотрудника.

- AC5 `PASS`
  Целевые проверки прошли:
  - `TasksFlow`: test/build/check
  - `Wesetup.ru`: helper test + typecheck

## Verification

- `C:\www\TasksFlow`: `npm test -- wesetup-journal-mode.test.ts`
  Raw: [tasksflow-vitest.txt](raw/tasksflow-vitest.txt)

- `C:\www\TasksFlow`: `npm run build`
  Raw: [tasksflow-build.txt](raw/tasksflow-build.txt)

- `C:\www\TasksFlow`: `npm run check`
  Raw: [tasksflow-check.txt](raw/tasksflow-check.txt)

- `C:\www\Wesetup.ru`: `node --import tsx --test src/lib/tasksflow-journal-ui.test.ts`
  Raw: [wesetup-journal-ui-test.txt](raw/wesetup-journal-ui-test.txt)

- `C:\www\Wesetup.ru`: `npx tsc --noEmit --pretty false`
  Raw: [wesetup-tsc.txt](raw/wesetup-tsc.txt)

## Touched Files

- `C:\www\TasksFlow\client\src\components\JournalModeComposer.tsx`
- `C:\www\TasksFlow\client\src\components\JournalStepCard.tsx`
- `C:\www\TasksFlow\client\src\components\TaskViewDialog.tsx`
- `C:\www\TasksFlow\client\src\pages\CreateTask.tsx`
- `C:\www\TasksFlow\shared\wesetup-journal-mode.ts`
- `C:\www\TasksFlow\tests\wesetup-journal-mode.test.ts`
- `C:\www\Wesetup.ru\src\app\api\integrations\tasksflow\journals-catalog\route.ts`
- `C:\www\Wesetup.ru\src\lib\tasksflow-journal-ui.ts`
- `C:\www\Wesetup.ru\src\lib\tasksflow-journal-ui.test.ts`

## Notes

- Пуш не выполнялся.
- Небольшой compile-fix в `TaskViewDialog.tsx` сделан попутно, чтобы `TasksFlow` снова проходил `npm run check`.
