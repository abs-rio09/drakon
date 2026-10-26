---
name: drakon-motion
description: DRAKON motion rules (durations, easing, which properties may move, reduced motion, page and shared-image view transitions, sheets, stagger). Use when adding or changing any animation, transition, hover/press effect, loading state, sheet or page change in web/.
paths:
  - web/src/**/*.tsx
  - web/src/**/*.ts
  - web/src/index.css
---

# Motion in DRAKON

Calm, fast, soft. Better animation, not more. If unsure, leave it still.

## Tokens (web/src/index.css, `@theme`)
| Use | Class | Value |
|---|---|---|
| Press, hover, colour/border fades | `duration-fast` | `--duration-fast` 150 ms |
| Small UI: menus, chips, cart pop, check state | `duration-base` | `--duration-base` 250 ms |
| Page change, sheets, image fly, image fade-in, hero | `duration-slow` | `--duration-slow` 400 ms |
| Entering | `ease-out-drakon` | `cubic-bezier(.2,.7,.2,1)` |
| Leaving | `ease-in-drakon` | `cubic-bezier(.4,0,1,1)` |

- Never over 500 ms. No bounce, no elastic, no springs, nothing that loops (no `animate-pulse`, no shimmer).
- Components use the classes above or `var(--duration-*)` / `var(--ease-*-drakon)` in CSS. Never `duration-300`, `ease-[cubic-bezier(...)]` or ms numbers in components.
- Keyframe animations live in `@theme` as `--animate-*` and use the tokens.

## What may move
- Only `transform` and `opacity` (plus `backdrop-filter`/`filter: blur` for the glass header). Colour and border fades are fine at `duration-fast`.
- Never animate `width`, `height`, `top`, `left`, `margin`, `padding` or `grid-template-rows`: they relayout every frame and stutter.
- Nothing may shift the layout: reserve space (fixed heights, aspect boxes, skeletons in the real shape).
- Press: `active:scale-[.97]` with `transition-transform duration-fast` (already in `button()` in `components/ui/styles.ts`).
- Ember (`accent`) only for the logo and the one main action per screen. Motion never adds orange.

## Reduced motion (required for every animation)
- Prefix movement with `motion-safe:` or add a `@media (prefers-reduced-motion: reduce)` rule. Reduced = a short fade (`duration-fast`) or nothing.
- View transitions: the reduced-motion block in `index.css` turns them into a plain fade or instant change. Keep it working.

## Page changes and the shared photo
- React 19.3 `<ViewTransition>` (from `react`) + the router: `BrowserRouter` wraps every navigation in `startTransition`, so a keyed `<ViewTransition>` around the page in `RootLayout` animates route changes. Do not use react-router's `viewTransition` prop (framework/data mode only).
- Browsers without the View Transitions API change page instantly. Never polyfill.
- Shared element: `<ProductPhoto shareName={productPhotoName(slug)}>` (`components/product/photoName.ts`) on both sides; it wraps a named `<ViewTransition share="photo-fly">`. A name must be on the page **once** (ProductCard and the product page's main photo only).
- The receiving side must render the named element in the same commit. The card passes its photo in the link state (`ProductLinkState`) and the product page's skeleton shows it at once; keep that pattern for any new shared element. Never block navigation to make it fly.
- React does not animate: the browser Back/Forward buttons (popstate is finished synchronously for scroll restoration, so the change is instant) and shared elements that are off screen. Both are correct; do not work around them.
- Scroll changes that must be in the "new page" picture run in `useLayoutEffect` (see `ScrollManager`).

## Sheets (phone menu): `components/ui/Sheet.tsx`
- Enter: `translate` from the edge + backdrop `opacity`, `duration-slow ease-out-drakon`. Leave: `duration-base ease-in-drakon`.
- Dim backdrop (`bg-scrim`), Esc and tap outside close, focus moves in, Tab is trapped, focus returns to the button that opened it, page scroll is locked while open. Native `<dialog>` + `showModal()` with Tailwind `starting:` and `transition-discrete`; reuse it instead of building another overlay.

## Lists
- Stagger only on the first load of a list (shop grid, archive): at most the first 6 items, `--stagger-step` (40 ms) apart, `animate-rise`. Use `useStagger(state.status)` from `components/ui/stagger.ts`; it already skips cached lists, filter changes and reduced motion. Never on scroll.

## Check before you commit
1. `cd web && npm run build && npm run lint && npm test`.
2. Playwright at 390 and 1440: accessibility snapshot, console has no errors, and nothing shifts (compare element boxes before/after).
3. Emulate `prefers-reduced-motion: reduce` and check the change is a fade or instant.
4. No new npm package. If something truly needs one (springs, gestures), stop and add it to `docs/open-questions.md` with the reason.
