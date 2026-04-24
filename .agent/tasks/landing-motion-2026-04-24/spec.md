# Landing Motion And Visibility Optimization

## Scope
Improve the public WeSetup landing page with intentional motion and offscreen rendering optimization. Keep the current content and visual direction, but make the page feel more alive on desktop and mobile.

## Acceptance Criteria
- AC1: The main landing hero has visible, restrained entrance motion for badge, title, copy, CTA, chips, and product mockups.
- AC2: Public landing sections reveal as they enter the viewport and fade out when far outside the viewport.
- AC3: Offscreen landing sections use browser-native rendering optimization (`content-visibility: auto` with intrinsic size) so below-fold content is cheaper to render.
- AC4: Mobile/tablet receive the same motion system without horizontal overflow or layout jumps.
- AC5: Users with `prefers-reduced-motion: reduce` get no transform animation and all content remains visible.
- AC6: The implementation keeps the landing server-rendered and SEO-readable; JS only enhances visibility/motion after hydration.
- AC7: TypeScript, lint, and production build pass, or any environment blocker is documented.

## Design Notes
Visual thesis: a living HACCP operations board with soft depth, floating product surfaces, and calm reveal motion.

Content plan: preserve existing landing order and copy; animate hierarchy rather than adding new marketing blocks.

Interaction thesis:
- Hero enters as a staged poster: badge, headline, copy, CTA, chips, mockups.
- Product mockups drift subtly to create depth without distracting from the CTA.
- Sections use IntersectionObserver to toggle visible state, while CSS `content-visibility` lets the browser skip offscreen layout/paint.
