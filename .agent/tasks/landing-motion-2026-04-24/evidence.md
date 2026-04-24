# Landing Motion Evidence

## Verdict
PASS

## Acceptance Criteria
- AC1 PASS: Hero elements use staged `landing-rise` animation classes (`hero-badge`, `hero-title`, `hero-copy`, `hero-cta`, `hero-chips`, `hero-fan`).
- AC2 PASS: `LandingMotion` toggles `data-inview` with `IntersectionObserver`; browser smoke confirmed hidden targets become visible after scroll.
- AC3 PASS: Landing sections and footer use `content-visibility: auto` with intrinsic size.
- AC4 PASS: Browser smoke passed at 1440x1100 and 390x844 with HTTP 200, no overlay, and no console errors.
- AC5 PASS: Browser smoke with `prefers-reduced-motion: reduce` confirmed all 13 targets visible and hero animation disabled.
- AC6 PASS: Content is SSR-readable by default; `LandingMotion` only adds enhancement classes after hydration.
- AC7 PASS: lint, typecheck, production build, and browser smoke passed.

## Commands
- `npx eslint src/app/page.tsx src/components/public/landing-motion.tsx src/components/public/public-chrome.tsx`
- `npx tsc --noEmit`
- `npm run build`
- Playwright production smoke against `next start` on `127.0.0.1:3016`
- `git diff --check`

## Raw Artifacts
- `.agent/tasks/landing-motion-2026-04-24/raw/landing-motion-smoke.json`
- `.agent/tasks/landing-motion-2026-04-24/raw/landing-motion-desktop.png`
- `.agent/tasks/landing-motion-2026-04-24/raw/landing-motion-mobile.png`
- `.agent/tasks/landing-motion-2026-04-24/raw/next-start.out.log`
- `.agent/tasks/landing-motion-2026-04-24/raw/next-start.err.log`

## Notes
- Local database `127.0.0.1:5433` was unavailable during smoke. The landing now degrades gracefully by hiding the latest articles block instead of returning HTTP 500.
