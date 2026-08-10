# РЕЦЕПТ миграции одного журнала на общие примитивы

Составлен по факту двух пилотов — `hygiene` и `disinfectant_usage`
(фаза C2). Эталон стиля — `src/components/journals/cleaning-document-client.tsx`.

Один журнал = обычно два файла:

- `src/components/journals/<code>-documents-client.tsx` — **список** документов;
- `src/components/journals/<code>-document-client.tsx` — **сам документ**.

Мигрировать их можно независимо. Ниже — чек-лист по шагам.
Правило номер ноль: **поведение и публичное API компонентов не меняем**,
серверный PDF (`/api/journal-documents/[id]/pdf`) не трогаем, UI-тексты
русские, мобильную вёрстку не перестраиваем (только цветовые токены).

---

## Часть A. Список документов (`*-documents-client.tsx`)

### A1. Шапка и вкладки — из `document-list-ui.tsx`

```tsx
import {
  EmptyDocumentsState,
  DocumentActionsMenu,
  JournalTabs,
  JournalTopBar,
} from "@/components/journals/document-list-ui";
```

Удалить локальную копипасту `<h1> + «Инструкция» + «Создать документ»` и
пару `<Link>Активные/Закрытые</Link>`, заменить на:

```tsx
<JournalTopBar
  heading={getJournalDocumentHeading(templateCode, activeTab === "closed")}
  activeTab={activeTab}
  templateCode={templateCode}
  templateName={templateName}
  users={users}
/>

<JournalTabs activeTab={activeTab} templateCode={routeCode} />
```

- `JournalTabs` строит ссылки `/journals/<templateCode>` — если в журнале
  route-код отличается от template-кода (как в `disinfectant_usage`),
  передавать сюда **routeCode**.
- Если журнал создаёт документ с преднастроенным `config` и не может
  использовать общий `<CreateDocumentDialog>` — передать свою кнопку в
  `createSlot`:

```tsx
<JournalTopBar
  …
  createSlot={
    <Button
      className="h-11 w-full rounded-2xl bg-[#5566f6] px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#4a5bf0] sm:w-auto"
      onClick={() => setCreateOpen(true)}
    >
      <Plus className="size-4" /> Создать документ
    </Button>
  }
/>
```

Карточку документа приводить к `JOURNAL_LIST_CARD_CLASS` +
`JOURNAL_CARD_TITLE_CLASS` / `JOURNAL_CARD_LABEL_CLASS` /
`JOURNAL_CARD_VALUE_CLASS` / `JOURNAL_CARD_SECTION_CLASS`
из `@/components/journals/journal-responsive`. Пустое состояние —
`<EmptyDocumentsState />`. Меню «…» — `<DocumentActionsMenu>` вместо
своего `DropdownMenu` (если журналу хватает Настройки / Печать / Удалить).

### A2. Delete / статус / PDF — `useJournalDocumentActions`

```tsx
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";

const { deleteDocument, setStatus, openPdf, isDeleting, isChangingStatus } =
  useJournalDocumentActions(); // в списке id передаём в каждый вызов
```

Выкинуть локальные `fetch("/api/journal-documents/…", { method: "DELETE" })`,
`PATCH { status }` и `window.open(…/pdf)`.

Удаление — обязательно `confirmAsync danger` со **счётчиком последствий**
(хук делает это сам, нужно только наполнить `bullets` реальными числами
из `config`/props):

```tsx
await deleteDocument({
  documentId: document.id,
  description: `Документ «${docTitle}» будет удалён безвозвратно.`,
  bullets: [
    { label: `Записей о получении: ${cfg.receipts.length}`, tone: "warn" },
    { label: `Записей о расходе: ${cfg.consumptions.length}`, tone: "warn" },
  ],
  successMessage: `Документ «${docTitle}» удалён`,
  errorMessage: "Не удалось удалить документ",
});
```

Перенос в архив / возврат в активные:

```tsx
await setStatus("closed", { documentId: document.id });
await setStatus("active", { documentId: document.id });
```

Самодельные модалки «Перенести в архив документ …» заменять на
`confirmAsync({ variant: "warn", bullets: […] })` — меньше кода и
единый вид.

Печать: `onSelect={() => openPdf({ documentId: document.id })}`.
Хук сам покажет toast, если браузер заблокировал popup.

### A3. Ошибки сети

Все ветки `if (!response.ok)` должны читать `error` из тела ответа и
показывать `toast.error(...)`. Хук делает это за нас; для оставшихся
локальных `fetch` (например, PATCH настроек документа) — тот же приём:

```tsx
const data = (await response.json().catch(() => null)) as { error?: string } | null;
throw new Error(data?.error || "Не удалось сохранить настройки документа");
```

---

## Часть B. Документ (`*-document-client.tsx`)

### B1. Баннер «журнал закрыт»

```tsx
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";

{status !== "active" ? (
  <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать отметки сотрудников." />
) : null}
```

Ставить сразу под `<h1>` / тулбаром, до таблиц. Компонент сам `print:hidden`.

### B2. Никаких нативных диалогов

- `window.confirm` → `confirmAsync` из `@/components/ui/confirm-async`
  (`variant: "danger"` для удаления, `"warn"` для закрытия журнала;
  в `bullets` — что именно исчезнет и сколько строк).
- `window.prompt` → `promptAsync` из `@/components/ui/prompt-async`:

```tsx
import { promptAsync } from "@/components/ui/prompt-async";

const name = await promptAsync({
  title: "Новая прививка",
  label: "Название",
  placeholder: "Например, АДС-М",
  validate: (v) => (v.trim() ? null : "Введите название"),
});
if (name === null) return; // отмена
```

`promptAsync` умеет `type: "text" | "number" | "date"`, `defaultValue`,
`description`, `confirmLabel`.

### B3. Нормализация индиго

Заменить паразитные оттенки на токены дизайн-системы:

| было | стало |
|---|---|
| `#5563ff`, `#5863f8`, `#4d58f5` | `#5566f6` |
| `#4554ff`, `#4452ee`, `#4b57ff`, `#4756f6` | `#4a5bf0` |

Заодно: `border-[#d8dae6]`/`#d7dbea`/`#dfe1ec` → `border-[#dcdfed]`,
`bg-[#f1f2f8]`/`#f3f4fb` → `bg-[#fafbff]`, `text-[#7a7c8e]`/`#73738a` →
`text-[#6f7282]`.

В новом коде можно писать `bg-brand` / `hover:bg-brand-hover` — токены
`--color-brand` / `--color-brand-hover` объявлены в `@theme` в
`src/app/globals.css`. Массово переименовывать существующие литералы
**не нужно**.

### B4. Таблицы: «экран = WeSetup, Ctrl+P = бумага»

Объявить в начале файла (копия из `cleaning-document-client.tsx`):

```tsx
import { JOURNAL_TABLE_VIEWPORT_CLASS } from "@/components/journals/journal-responsive";

const GRID_CELL_CLASS = "border border-[#ececf4] print:border-black";
const GRID_HEAD_CELL_CLASS =
  "border border-[#ececf4] bg-[#f8f9fc] print:border-black print:bg-white";
const GRID_VIEWPORT_CLASS = `${JOURNAL_TABLE_VIEWPORT_CLASS} print:mx-0 print:overflow-visible print:rounded-none print:border-0 print:bg-transparent print:px-0 print:shadow-none`;
```

Дальше:

1. `className="… border border-black …"` → `className={`… ${GRID_CELL_CLASS} …`}`
   (в `<thead>` — `GRID_HEAD_CELL_CLASS`).
2. `border-black/70` → `border-[#ececf4] print:border-black`.
3. Серые заливки шапки (`bg-[#f2f2f2]`, `bg-[#eee]`) убрать со `<tr>` —
   цвет живёт в `GRID_HEAD_CELL_CLASS`; либо
   `<thead className="bg-[#f8f9fc] print:bg-white">`.
4. Обёртку `-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0` заменить на
   `className={GRID_VIEWPORT_CLASS}`.

Проверка: на экране рамок чёрных не остаётся, в `Ctrl+P` — таблица снова
чёрно-белая «бумажная».

### B5. Мобильный переключатель

Если в файле лежит своя копия «Карточки / Таблица» + свой localStorage:

```tsx
import { MobileViewToggle, MobileViewTableWrapper } from "@/components/journals/mobile-view-toggle";
import { useMobileView } from "@/lib/use-mobile-view";

const { mobileView, switchMobileView } = useMobileView("<journalCode>");
…
<MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
```

Если старый ключ localStorage отличался (`hygiene-mobile-view`,
`cleaning-mobile-view`), добавить одноразовую миграцию — как в
`hygiene-document-client.tsx`: если `journal-mobile-view:<code>` ещё нет,
перенести значение из легаси-ключа и удалить его.

### B6. Что не трогаем

- `JournalDocumentHeader` / `JournalDocumentTitle` / `JournalLegendBlock` —
  если журнал их уже использует, оставляем как есть.
- Серверный PDF-рендер и любые `/api/journal-documents/[id]/…` эндпоинты.
- Demo-сидеры в `src/app/(dashboard)/journals/[code]/page.tsx` (отдельная фаза).
- Мобильную раскладку карточек — меняем только цвета.

---

## Часть C. Проверка (обязательна перед сдачей)

```bash
npx tsc --noEmit --skipLibCheck   # новых ошибок в src/** быть не должно
npm run lint                       # число errors не выросло
npm run build                      # роут журнала собирается
```

Глазами: список → создание → настройки → печать → удаление (модалка со
счётчиком) → закрытие журнала (баннер) → `Ctrl+P` (бумажный вид).
