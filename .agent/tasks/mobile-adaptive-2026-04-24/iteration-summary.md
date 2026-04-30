# Mobile-адаптив прогон 2026-04-24

## Сессия

Dynamic `/loop` по задаче мобильной адаптации. Режим: audit → TZ → surgical fix
→ commit → repeat. Push отложен («сделать одним деплоем утром»).

## Проверенные viewports

320, 375, 414, 500, 640, 768, 1024.

## Проверенные поверхности

- Public: `/`, `/blog`, `/features/autofill`, `/journals-info`,
  `/journals-info/hygiene`, `/login`, `/register`, `/invite/[token]` (demo)
- Mini: `/mini` (error page без initData)

Auth-gated surfaces (dashboard/journals/staff/settings/reports) — code-review,
локальная БД недоступна (SSH tunnel не поднят, memory/local-dev-no-database).

## Коммиты

### `4b77dcf` — hero-fan dead-space + clip

- `landing-hero pb-24` → `pb-14` на мобиле
- `hero-fan min-h-[420px] mt-14` → `min-h-[400px] mt-10` на мобиле
- Мобильный `TelegramMockup` получил `mask-image: linear-gradient(black 82%, transparent)`
  — клип чата внутри `aspect-9/19` теперь читается как намеренный превью-фейд

### `9108b45` — dark-hero padding

5 dark-hero компонентов имели `p-8 md:p-10`, съедая 64px ширины на 320-375
устройствах. Приведено к паттерну `/dashboard`: `p-5 sm:p-8 md:p-10`.

Файлы:
- `src/components/journals/journals-browser.tsx`
- `src/components/staff/staff-page-client.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/settings/journals/journals-settings-client.tsx`
- `src/app/(dashboard)/settings/integrations/tasksflow/tasksflow-settings-client.tsx`

### `7b0b006` — blog hero паддинг

`src/app/blog/page.tsx`: `px-6 py-16 md:px-12 md:py-20` →
`px-5 py-10 sm:px-6 sm:py-14 md:px-12 md:py-20`. Выровнял по паттерну
features и journals-info.

### `2e29d0b` — pricing-card калькулятора

`src/app/page.tsx`: третья карточка «Подписка + оборудование»
`p-6 md:p-7` → `p-5 sm:p-8`, чтобы визуальный ритм совпадал с соседними
Free и Подписка карточками.

## Не трогал

- Document-клиенты журналов (34 из 37 имеют `mobileView` cards/table
  toggle, 4 оставшихся — `overflow-x-auto + min-w-[…]`). Паттерн
  корректный.
- Dashboard header burger — починен в предыдущей сессии
  (`Sheet side="right"`), комментарий в `header.tsx:308-316` явно
  объясняет.
- `mini-theme.css` (191-строчный diff) — dual-theme rewrite из
  предыдущей сессии, оставляю как pending работу пользователя.

## Push

Пуш отложен, пользователь сделает одним деплоем утром.
