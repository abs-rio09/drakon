# Button

Buttons start an action: `dk-btn` plus one variant class. Labels are sentence case and start with a verb.

- **Primary** (`dk-btn--primary`): `accent` fill, `on-accent` text, weight 600. One per screen, for the thing the page is for: "Add to cart", "Place order", "Shop the drop".
- **Secondary** (`dk-btn--secondary`): a `line-strong` outline with `ink-strong` text. The second choice: "See the archive", "Track order".
- **Ghost** (`dk-btn--ghost`): text only, underlined on hover. Cancel, Back and low-stakes actions.
- **Icon** (`dk-btn--icon`): a round 44px button for search, cart and menu. It always needs an `aria-label`.
- **Sizes:** default is 44px tall (14px label). `dk-btn--lg` is 52px (16px label) for the hero and the product page. `dk-btn--block` fills its container in forms and panels.

What you provide: a `<button>` (or an `<a>` for navigation), the label, and an optional 16px icon before it.

**Do:**
- Use a verb first: "Add to cart", not "Cart".
- Show the loading state as disabled with the same label.

**Don't:**
- Put two primary buttons on one screen.
- Append arrows to the label, use gradients, white text on orange, or hover lifts.

Hand-written from `src/components/home/Hero.tsx` and `FeaturedProducts.tsx`, with the gradient replaced by a flat `accent` fill; refreshed for the Ember Gallery direction.
