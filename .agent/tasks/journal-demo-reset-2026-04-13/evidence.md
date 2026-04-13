# Evidence

## Verification Summary
- `AC1` PASS: `npm run reset:demo:journals` deleted old demo journal data and recreated the demo organization state while preserving the owner login `admin@haccp.local`.
- `AC2` PASS: the active staff now contains 8 users with distinct roles/positions and no legacy demo emails such as `chef@haccp.local` or `waiter@haccp.local`.
- `AC3` PASS: all 35 active journal templates have exactly 1 document in the database, and every journal has meaningful seeded content via at least one document entry or populated document config.
- `AC4` PASS: fresh verification recorded actual DB counts and `npx tsc --noEmit` completed successfully.

## Commands
- `npm run reset:demo:journals`
- `npx tsc --noEmit`
- ad-hoc Prisma verification query for active users and per-template coverage
- ad-hoc Prisma verification query for meaningful journal content (`entries > 0` or populated `config`)

## Key Results
- Organization: `cmnx55fg000005o9maiggrvya` (`Тестовая организация (админ)`)
- Active users: `8`
- Active templates: `35`
- Journal documents: `35`
- Journal document entries: `268`
- Template coverage: every active template has `count = 1`

## Seeded Staff
- `admin@haccp.local` — Крылов Денис Сергеевич — `owner` / `Управляющий`
- `quality@haccp.local` — Белова Елена Андреевна — `technologist` / `Технолог по качеству`
- `souschef@haccp.local` — Никитин Павел Игоревич — `operator` / `Су-шеф`
- `hotcook@haccp.local` — Волкова Анна Дмитриевна — `operator` / `Повар горячего цеха`
- `coldcook@haccp.local` — Орлов Илья Максимович — `operator` / `Повар холодного цеха`
- `pastry@haccp.local` — Мельникова Софья Романовна — `operator` / `Кондитер`
- `storekeeper@haccp.local` — Кузьмин Артем Сергеевич — `operator` / `Кладовщик`
- `sanitation@haccp.local` — Егорова Марина Викторовна — `operator` / `Санитарный работник`

## Raw Artifacts
- `raw/reset-demo-journals.txt`
- `raw/db-state.json`
- `raw/ac3-content-check.json`
- `raw/tsc.txt`
