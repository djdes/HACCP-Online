# Journals home redesign — FINAL

## Verdict: PASS

## Scope shipped
- Commit: `25d144c feat(journals): redesign home page with dark hero + stat pills + themed cards`
- Files:
  - `src/components/journals/journals-browser.tsx` (full rewrite)
  - `.agent/tasks/journals-home-redesign/plan.md` (new)
- `src/app/(dashboard)/journals/page.tsx` — unchanged (props shape preserved).
- No schema changes, no server-side changes.

## Visual language applied (matches login page + settings hub)
- Full-width dark hero `bg-[#0b1024]` with mesh-gradient blobs (`#5566f6`, `#7a5cff`, `#3d4efc`) + grid overlay.
- Brand icon tile `rounded-2xl bg-white/10 ring-1 ring-white/20` with `NotebookPen`.
- 4 stat pills (Всего / Базовых / Расширенных / Обязательных).
- Top-right subscription plan pill `• ПЛАН: РАСШИРЕННЫЙ`.
- Search input `h-12 rounded-2xl` with focus ring `#5566f6/15`.
- Per-tariff sections: indigo theme + Sparkles for Basic, amber theme + Crown for Extended; header shows live "N / total" chip when filter active, plus optional «требуется апгрейд» chip.
- Template cards: per-journal lucide icon in tariff-coloured tile, ArrowRight hover-shift, SanPiN / ХАССП / Premium chips, mono code pill for quick scanning.
- Empty state: dashed-border panel with `SearchX` illustration and a "Очистить поиск" reset button.

## Behaviour preserved
- Deferred search across name + description + code.
- `canAccessTariff` gating stays soft (locked chip + dimmed card, still clickable).
- Links to `/journals/<code>` unchanged.

## Evidence
- Local `npx tsc --noEmit` — clean.
- Local `npx eslint src/components/journals/journals-browser.tsx` — clean.
- Prod build-sha on wesetup.ru = `25d144c` (header chip confirmed).
- Prod smoke via Playwright (admin@haccp.local):
  - `journals-desktop-1440.png` — full page at 1440×900, 35 journals grouped correctly.
  - `journals-mobile-390.png` — full page at 390×844, hero collapses, 2×2 pills, 1-col cards.
  - `journals-search-steklo.png` — zero-match query → empty state renders.
  - `journals-search-gigien.png` — 2/35 match, section chips show `1/13` and `1/22`.

## Non-goals / not touched
- No changes to `src/lib/journal-tariffs.ts`.
- No changes to individual journal document clients.
- Search is still pure substring (no Russian morphology). Out of scope.
