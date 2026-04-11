# Task Spec: journals-search-2026-04-11

## Metadata
- Task ID: journals-search-2026-04-11
- Created: 2026-04-11
- Repo root: C:\www\Wesetup.ru

## Guidance sources
- AGENTS.md
- CLAUDE.md
- src/app/(dashboard)/journals/page.tsx
- src/components/ui/input.tsx

## Original task statement
Add a convenient search on the journals tab because there are many journals and it is hard to find the needed one.

## Current repo findings
- `src/app/(dashboard)/journals/page.tsx` renders all active journal templates as a static grid of cards.
- There is no filtering, quick navigation, or empty state for large journal catalogs.
- The project already has a shared `Input` component suitable for a lightweight client-side search UI.

## Acceptance criteria
- AC1: The journals page shows a visible search field above the card grid without removing the existing journal cards or badges.
- AC2: Typing in the search field filters journals immediately on the client by journal name, description, and code, case-insensitively.
- AC3: The page shows helpful feedback for large catalogs: result count when a query is active and a clear empty state when nothing matches.
- AC4: Clearing the query restores the full journal list without a reload and keeps navigation to journal pages working.
- AC5: The implementation stays consistent with the existing dashboard UI and passes fresh verification on the current codebase.

## Constraints
- Freeze spec only in this step; no implementation changes beyond this file.
- Keep the change scoped to the journals catalog page and directly related presentation components.
- Reuse existing UI primitives and avoid introducing server/API changes unless required.

## Non-goals
- Adding backend full-text search.
- Changing journal detail pages.
- Reordering or redesigning the rest of the dashboard.

## Verification plan
- `npm run lint`
- Targeted code inspection for search behavior, empty state, and preserved links

## Key risks
- Moving a server-rendered page to a mixed server/client structure must preserve the existing template data and links.
- Search should remain responsive and predictable with Russian text and optional descriptions.
