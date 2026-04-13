# Journal UI Parity 2026-04-13

## Summary
Убрать остаточные `Minor`-расхождения в action surface журналов после source parity audit от 2026-04-13. Основной разрыв: локальные document action menus не попадают в DOM до открытия, из-за чего аудит не видит `Печать`, `Удалить`, `Сделать копию`, `Отправить в закрытые`. Дополнительно в `cleaning_ventilation_checklist` отсутствует кнопка `Инструкция`.

## Acceptance Criteria
- AC1: Во всех затронутых `*documents-client.tsx` dropdown-меню действий документа рендерятся в DOM и больше не теряют audit-visible labels в закрытом состоянии.
- AC2: `cleaning_ventilation_checklist` получает кнопку `Инструкция` в header area, согласованную со стилем других журналов.
- AC3: `npm run audit:source:parity` на текущем коде больше не дает `buttons: WARN` из-за отсутствующих `Печать`, `Удалить`, `Сделать копию`, `Отправить в закрытые`, `Инструкция`.
- AC4: `npx tsc --noEmit` проходит на свежем состоянии репозитория.

## Implementation Notes
- Предпочесть минимальный безопасный diff: не переписывать layout карточек, если parity достигается через `forceMount` и точечные header fixes.
- Сохранить существующее поведение dropdown-меню и destructive flows.
- Обновить proof artifacts только после свежей верификации.
