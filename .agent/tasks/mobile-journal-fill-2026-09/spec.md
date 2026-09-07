# spec: мобильное заполнение журналов (10 фич)

TASK_ID: mobile-journal-fill-2026-09
Заморожено: 2026-09-07. Источник: план `crystalline-cuddling-spindle.md`, одобрен владельцем.

## Цель
Сделать карточный (нетабличный) режим журналов пригодным для заполнения с телефона —
на сайте и в Mini App одинаково (П-3).

## Acceptance criteria

- **AC1** Во всех журналах карточка на телефоне редактируема: нет ни одного
  `*-document-client.tsx`, где `RecordCardsView` получает items без `onClick`
  у карточки или хотя бы у одного поля. Отдельно: `climate_control` правится
  из карточек; `tracked-document-client` (generic-fallback) правится из карточек.
- **AC2** Числовой ввод: у всех числовых полей журналов есть `inputMode`,
  высота ≥ 44px на телефоне, норма подписана под полем, выход за норму
  подсвечивается при вводе. Время вводится ОДНИМ контролом (не часы+минуты).
  Есть хук `use-keyboard-inset`, поднимающий липкие элементы над клавиатурой.
- **AC3** Тап по ячейке в карточке открывает явный выбор значения (лист снизу
  или segmented control), а не перебирает варианты вслепую.
- **AC4** `TodayProgressStrip` доступна всем журналам через `JournalDocumentShell`;
  подключена везде, где есть понятие «сегодня».
- **AC5** `photo` и `signature` — настоящие типы полей в `TaskFormField` и
  `DynamicForm`; при `photoRequired` сохранение блокируется без снимка.
- **AC6** В карточном режиме есть ось «Сегодня» (плоский список сущностей за
  сегодня) и она включена по умолчанию для матричных журналов.
- **AC7** Есть полноэкранный конвейер заполнения (одна сущность — один экран,
  прогресс, авто-переход), с режимом rolling. Подсказки-walkthrough доступны
  для всех журналов, а не для двух.
- **AC8** Есть `GET /api/journals/[code]/row-form`, отдающий `TaskFormSchema`
  через `getAdapter(code).getTaskForm()`; `/mini/claim` больше не держит свою
  копию `JOURNAL_FORMS`.
- **AC9** Офлайн-очередь вынесена в `src/lib/offline-queue.ts` и работает на
  сайте, а не только в Mini App; `public/sw.js` перестал быть kill-switch.
- **AC10** QR/NFC работает не только для холодильника: есть `/scan/[objectId]`
  для помещений и оборудования. Есть Web Bluetooth-щуп и OCR-подстановка числа.

## Сопутствующие баги (чиним попутно)
- **B1** `textarea` не рендерится в `DynamicForm` (`complaint_register`).
- **B2** `isDocumentTemplate()` не знает `complaint_register`, `audit_protocol`, `audit_report`.
- **B3** `/mini/documents/[id]` без `data-journal-doc-pan` / `data-journal-print-root`.
- **B4** `.mini-root > * { position: relative }` ломает `fixed`-навигацию Mini App.
- **B5** `.mini-document-host` — мёртвый класс.
- **B6** `JOURNAL_DOCUMENT_SELECTION_BAR_CLASS` прибит к `top-[72px]` шапки сайта.

## Ограничения
- П-3: любая правка карточек должна работать и в `/mini/documents/[id]`.
- П-12/П-15/П-19: запись в TasksFlow только через outbox с Idempotency-Key.
- Дизайн-система: `.claude/skills/design-system`, палитра `#5566f6`, `rounded-2xl`.
- UX-6: подтверждения через `ConfirmDialog`, не `window.confirm`.
- Гейт: `npm run typecheck` обязан проходить (pre-push хук + CI).
- Локальная БД — туннель в прод: e2e с записью только на демо-организации.
