# Badge

Short sentence-case labels for a product's status or an order step, in `micro` on a `radius-full` pill. On photos they are glass (`surface-glass` with blur) so they read on any shot.

- **Neutral** (`dk-badge`): a past order step ("Delivered") or a category.
- **Limited** (`dk-badge--limited`): `ink-strong` text with a 6px `ink-strong` dot in front, reading "Limited run". Only on the product page photo; in grids the gallery label says it instead.
- **Sold out** (`dk-badge--soldout`): `ink-muted` text and a 12px lock icon. It always appears with the sold-out card treatment.
- **Current** (`dk-badge--current`): an `accent` fill with `on-accent`, for the current step in order tracking ("Confirmed"). It is that screen's one accent.

What you provide: one or two words. An icon is optional, except the lock on Sold out.

**Do:**
- Use at most one badge per product photo, top-left at `space-3`.

**Don't:**
- Use tracked uppercase, rotated stickers or red for sold out.
- Stack badges.

Hand-written from `src/components/home/Hero.tsx` and `SoldOutSection.tsx`, refreshed for the Ember Gallery direction (sentence case, glass pill, bone dot).
