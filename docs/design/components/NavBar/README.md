# NavBar

The site header: a full-width bar, `header-height` tall, with the logo, four links and the search, cart and menu buttons. Content is capped at `container-max`.

- **Bar:** `surface-glass` with a 20px backdrop blur and a `line` hairline at the bottom. On the home hero it starts transparent over the photo (`dk-nav--over-photo`) and turns glass once the page scrolls.
- **Logo:** the `dk-logo` mark and wordmark, which link home. The only place the mark appears on a page.
- **Links:** Shop, Collections, Sold out, Track order, in `label`, `ink-muted`. The current page is `ink-strong` with a 2px `ink-strong` underline and `aria-current="page"`.
- **Actions:** round icon buttons for search, account and the cart. The account button opens Sign in, or My account when signed in; on account pages it gets a `field` fill and `aria-current="page"`. The cart shows a `dk-count` bubble in `ink-strong` with `on-accent` text when it has items (orange stays for the page's main button).
- **Phone:** below 768px the links hide and the menu button opens a `surface-raised` sheet with `radius-2xl` and `shadow-overlay`. `dk-nav--compact` forces this layout.

What you provide: the link list for the current sitemap, the cart count, and the menu sheet's open state.

**Do:**
- Keep it to four links.
- Show the cart count only when it is above 0.

**Don't:**
- Float the bar as a rounded pill or add a drop shadow.
- Add theme or language toggles (dark only; Bangla comes in Phase 2).
- Add a points button before rewards exist, or a text "Log in" link next to the account icon.
- Make sign-in a step of checkout: guest checkout always stays.

Hand-written from `src/components/layout/Header.tsx`, with the auth, points, theme and language controls removed for the MVP, refreshed for the Ember Gallery direction.
