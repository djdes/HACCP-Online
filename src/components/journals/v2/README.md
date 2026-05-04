# Design v2 — унифицированные компоненты журналов

См. `docs/PIPELINE-VISION.md` раздел P3.

## Принципы

1. **Только токены wesetup-design** — никаких `text-muted-foreground` / `bg-card` / generic-shadcn defaults. Хекс-литералы из `.claude/skills/design-system`.
2. **Радиус**: `rounded-3xl` для карточек, `rounded-2xl` для кнопок/инпутов, `rounded-full` для pill'ов.
3. **Тень модалки**: `shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]`.
4. **Тень карточки**: `shadow-[0_0_0_1px_rgba(240,240,250,0.45)]`.
5. **Spacing**: 4px baseline. `gap-2/3/5/8`, `p-5/6/7`.
6. **Заголовки**: H1 — `text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]`.

## Компоненты

- `JournalToolbar` — backlink + title + rightActions (Print, Settings, Close)
- `JournalSettingsModal` — общая обёртка для модалки настроек
- `JournalEntryDialog` — Add/Edit row dialog
- `JournalReferenceTable` — таблица-справочник (legend, "Что моется")

Каждый компонент принимает только данные и handler'ы. Никакой логики
сетей / БД / fetch внутри.

## Migration shim

В каждом `<code>-document-client.tsx` legacy-render остаётся, добавляется
shim в начало return:

```tsx
if (useV2) {
  return <V2Layout {...props} />;
}
// existing legacy render below
```

`useV2` приходит из `page.tsx` на основе `org.experimentalUiV2`.

## Invariants

- Все существующие действия должны быть представлены
- Primary-CTA выше скролла
- Destructive отделены визуально
- ConfirmDialog везде
- MobileViewToggle сохранён
- Print работает
- Таблицы остаются таблицами
