# Итерация 1 — аудит адаптива (2026-04-24)

Прогон на виджетпортах 320 / 375 / 500 / 640. Dev server localhost:3000.

## Проверено

- `/` (landing) — 320, 375, 500, 640
- `/login` — 375
- `/journals-info` — 375
- `/journals-info/hygiene` — 375 (fullPage)
- `/features/autofill` — 375
- `/blog` — 375 (DB 500 — error screen)
- `/mini` — 375 (401 без Telegram initData — error screen)

Auth-gated пути (`/dashboard`, `/journals`, `/settings`) — не доступны: локальная БД отключена (SSH tunnel не поднят).

## Найденные проблемы

### P1. Landing `hero-fan` — dead-space + обрезанный чат на мобиле

**Место:** `src/app/page.tsx:405`, `src/components/public/screenshot-fan.tsx:33-35`.

**Симптом на 320-639px (до `sm` breakpoint):**
- контейнер `.hero-fan min-h-[420px]` и одинокий `TelegramMockup` 180×380px → ~40px пустоты под телефоном
- внутри телефона `aspect-[9/19] + overflow-hidden` обрезает последнее сообщение "Холодильник №3 — введите значение" посередине — выглядит как глюк
- под `min-h-420` секция добавляет ещё `pb-24` (96px) → ~150px воздуха перед "ЧТО ВНУТРИ"
- на 500-639px эффект самый заметный (телефон кажется потерянным)

**Фикс:**
1. `hero-fan`: `min-h-[420px]` → `min-h-[400px]` + `sm:min-h-[620px]` (без изменений sm+)
2. `landing-hero pb-24 sm:pb-32` → `pb-14 sm:pb-32`
3. `screenshot-fan` mobile: добавить fade-маску снизу телефона, чтобы обрезка выглядела намеренно. Реализация — градиент `mask-image: linear-gradient(to bottom, black 85%, transparent)` только внутри мобильного клона.

### P2. `landing-hero` — общий vertical rhythm

`pt-8 sm:pt-16` на мобиле ок, `pb-24` избыточен → сжимаем как в P1.

### P3. Document-журналы — уже адаптивные

34 из 37 document-client-компонентов используют `mobileView` (cards/grid), 4 оставшихся (`audit-report`, `register`, `scan-journal`, `tracked`) уже завернуты в `-mx-4 overflow-x-auto` или диалоги с `w-[calc(100vw-2rem)]`. Overflow-scroll на таблицах корректный. Ничего трогать не надо.

### P4. Dashboard header burger — OK

`Sheet side="right" w-[86%] max-w-[360px]` — уже починено в предыдущих итерациях (комментарий в `header.tsx:308-316` прямо об этом). Пол-экрана больше не белеет.

## Не проверено этой итерацией

- `/dashboard`, `/journals`, `/batches`, `/settings/*`, `/reports/*` — требуют БД
- `/register` мастер — не дошёл
- Telegram Mini App — без initData не открывается

Планируется во итерации 2 (подниму SSH tunnel или seed demo-org локально).
