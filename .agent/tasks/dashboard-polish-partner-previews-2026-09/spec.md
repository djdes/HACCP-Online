# Task: dashboard-polish-partner-previews-2026-09

Полный дизайн: `docs/superpowers/specs/2026-09-04-dashboard-polish-partner-hint-journal-previews-design.md`.

## Acceptance criteria

- **AC1** Бумажные карточки на `/dashboard` нейтральные (`#ececf4` рамка, `#fafbff` подложка, бейдж `#f5f6ff/#3848c7`); электронные остаются зелёными/красными.
- **AC2** На `/journals` менеджер может скрыть журнал с дашборда иконкой `EyeOff` через `ConfirmDialog` и включить обратно кнопкой «Включить» на отключённой карточке; оба действия идут через `PATCH /api/settings/journals` и завершаются toast + refresh. Сотруднику кнопка не показывается.
- **AC3** На мобиле (< 640px) шапка секции «Обязательные журналы»: заголовок, счётчик, иконка-кнопка «Настройка» и шеврон в одной строке; «Закрыть день» и «Закрыть выборочно» в одной строке в два столбца. Десктоп без изменений.
- **AC4** Справа от логотипа в шапке сайта и Mini App показывается еле заметная иконка `Handshake`; клик открывает модалку с сутью партнёрства, CSS-макетом white-label, актуальными ставками из `getCurrentRewardRule()` и кнопкой «Стать партнёром» → `/settings/partner`.
- **AC5** Иконка не показывается, если у организации есть активный `PartnerClient`, пользователь сам партнёр (`PartnerUser`), шапка white-label или организация `platform`. Покрыто unit-тестом helper'а.
- **AC6** Модель `JournalPreview` в Prisma; cron `GET /api/cron/journal-previews` с `checkCronSecret` рендерит первую страницу PDF активного документа через `pdfjs-dist` + `@napi-rs/canvas`, перерисовывает только изменившиеся документы, лимит 60/прогон, удаляет устаревшие (>30 дней, отключённые/удалённые). Unit-тест рендера PNG.
- **AC7** `GET /api/journal-previews/[code]` отдаёт PNG только своей организации с `Cache-Control: private, max-age=31536000, immutable`; 404 если нет.
- **AC8** Карточки на `/dashboard`, `/journals`, `/settings/journals` показывают реальное превью при наличии, иначе стандартный образец; бумажные всегда образец.
- **AC9** `npm run typecheck` и `npm run lint` проходят; тесты проекта (`vitest`) зелёные.
- **AC10** `whats-new-notes.ts` обновлён, строка cron добавлена в crontab прода, деплой прошёл, `/api/cron/journal-previews` на проде отвечает `ok`.

## Constraints
- Дизайн-система `.claude/skills/design-system`, никаких `window.confirm`.
- Никаких растровых скриншотов в модалке партнёрства.
- Chromium на проде не ставим.
