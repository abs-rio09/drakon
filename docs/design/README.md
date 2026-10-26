DRAKON sells limited playcards, sports toys, tech toys and clothes to night workers, gamers, coders and football fans in Bangladesh. The look is **Ember Gallery**: a private night gallery where each piece sits alone on dark stone under one warm light, with a small **gallery label** beside it that says what it is, whether it is a limited run, and what is left. The interface steps back so the product is the light source. When in doubt, remove something.

## Direction in five lines

- **Mood:** calm, collectible, sure of itself. Products are shown like pieces in a gallery, each with its label, not stock in a warehouse.
- **Colour:** deep midnight ground, warm bone-white text, cool steel greys. Ember orange on the logo mark and on the one main action of a screen, nowhere else.
- **Type:** Outfit only, with Noto Sans Bengali loaded for the Taka sign. Big, tight display; calm body; tabular figures on every price; sentence case everywhere.
- **Photos:** top-down on dark slate, one warm key light from the upper left at a low angle, long soft shadows, matte materials, fine grain. Collection tiles are material close-ups, never repeats of the product shots.
- **Motion:** one reveal when the home page loads, images fade in once, a slow zoom on photo hover. Nothing loops.

## The gallery label

The one memorable element. Everything else stays quiet so this can carry the collector feeling.

- **What it says, in this order:** the product name (`title`, `ink-strong`); one plain line on what it is and whether it is limited, in `caption` (`ink-muted`), for example "Playcard set, limited run" or "Sports toy, restocks"; then a hairline and a row with the price (`price`, tabular figures) on the left and the stock fact (`figure`, `ink-muted`) on the right: "12 left", "Only 3 left", "Sold out".
- **Where:** over the home hero photo (bottom right, `label-width` wide, `surface-glass` with blur, `radius-2xl`, `shadow-label`); under every product photo in grids (no box, straight on `surface`); in the product page buy box; on archive cards (price struck through, "Sold out" as the fact).
- **Facts only.** Stock comes from the database. If a number is not known, show nothing rather than a guess. No countdowns.
- **No middle-dot strings.** Separate facts by line or by position, not "A · B · C".
- **Phones:** a label over a photo moves under it, full width, same content.

## Content

- **Voice:** short, confident, collector-minded. Speak to the buyer as "you". Real copy: "Made once. Never again.", "Shop the drop", "We call you to confirm before we ship."
- **Casing:** sentence case for everything: buttons ("Add to cart"), nav ("Track order"), labels, badges ("Limited run", "Sold out"). No tracked all-caps labels.
- **Prices:** the Taka sign with no space and en-BD grouping, `৳1,250`, in `price` and `ink-strong`, tabular figures. Prices are never orange.
- **Scarcity:** state facts only: "Only 3 left", "Sold out, never restocked". No countdowns or "selling fast" claims the stock data cannot back.
- **Business facts on screen:** Cash on Delivery only; delivery ৳60 inside Dhaka and ৳100 outside (both come from admin settings); we call within 48 hours to confirm; limit per customer is shown next to quantity.
- **Create With Drakon:** say ideas are reviewed and any agreement comes separately. Never promise profit-sharing in UI copy.
- **No emoji** anywhere in the UI. No arrows glued onto button text.
- **Bangla** (Phase 2): `bangla-body` with the `bengali` family, same size steps as the English it replaces.

## Colour

Dark only. Build every page on `surface` with the grain texture; put task panels (summary, checkout steps, dialogs, admin tables) on `surface-raised`; fill inputs and empty image wells with `field`.

- **Accent budget per screen:** the logo mark, plus one main button. The current step dot in order tracking counts as that screen's one. Everything else is ink and steel.
- **Nav:** the current link is `ink-strong` with a 2px `ink-strong` underline. The cart count is an `ink-strong` bubble with `on-accent` text.
- **Text:** `ink-strong` for headlines, product names and prices; `ink` for body; `ink-muted` for intros, labels and meta; `ink-subtle` for hints and captions.
- **Orange text** (`accent-text`) only for inline links inside sentences and the required-field mark.
- **Text on orange** uses `on-accent`, never white.
- **Edges:** `line` is a hairline for decoration. Anything you click or type in gets `line-strong`.
- **Errors** use `danger-text`, always with a word or an icon.
- **Don't:** gradient washes, coloured glows, a second accent, light backgrounds, cards inside cards.

## Type

Outfit everywhere (`sans`, Google Fonts, 400–700), with Noto Sans Bengali second in the stack so `৳` renders from one face on every device. Load both in the same Google Fonts link. One scale, nothing in between:

| Step | Style | Use |
| --- | --- | --- |
| 88 | `display` | Home hero from 1024px. One per site. |
| 64 / 52 | `display-md` / `display-sm` | The hero on tablets / phones. |
| 48 | `heading-1` | Page titles, product name on its page, the order number. |
| 36 | `heading-2` | Section titles; page titles below 640px. |
| 28 | `price-lg` | Product page price, order totals. |
| 24 | `heading-3` | Panel titles. |
| 20 | `price` | Prices in grids, lists and labels. |
| 18 | `title`, `body-lg` | Product names in grids; intros. |
| 16 | `body` | Running text, table cells, summary rows, inputs. |
| 14 | `label`, `figure` | Buttons, nav, form labels; counts in labels. |
| 13 | `caption` | Hints, meta lines, stock notes. |
| 12 | `micro` | Badges and the cart count. |

- There is no 15, 17, 22, 30, 32, 34 or 44px text.
- Weights: 400 body, 500 labels, titles and prices, 600 display and headings. 700 only for the logo letter.
- Tight tracking only on display and headings. Never letter-space small text.
- Every price, count, order number and total uses tabular figures.

## Layout and spacing

- 4px base, layouts on an 8px grid: 4, 8, 12, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128. No 2, 6, 10, 14, 18 or 22px gaps.
- Sections get `space-32` top and bottom from 1024px, `space-24` on tablets, `space-20` on phones. A section header sits `space-14` above its grid.
- Content stops at `container-max`. Gutters: `space-4` below 640px, `space-6` to 1023px, `space-8` above.
- Product grid: 2 columns on phones (gap `space-4`), 3 from 640px, 4 from 1024px (column gap `space-10`, row gap `space-16`). Products sit on `surface` with no box: photo, then the gallery label.
- Section headers: title and one-line intro stacked on the left, the section link on the right, bottoms aligned.
- Forms: one column inside a panel, `space-2` label to input, `space-6` between fields; checkout steps are separated by hairlines, not boxes.
- Left-align text. Centre only single short lines (empty states).

## Shape and depth

- Radius grows with size: `radius-lg` thumbnails and chips, `radius-xl` buttons and inputs, `radius-2xl` product photos, labels and menus, `radius-3xl` panels, `radius-full` badges and round icon buttons.
- Depth comes from the photos and from two surface steps. `shadow-raised` on panels, `shadow-label` on gallery labels over photos, `shadow-overlay` on menus and dialogs. Product photos have no shadow; their own light does the work.

## Texture

- Full pages lay a faint grain tile (`img/grain.webp`, ±1% noise in `surface`) over `surface`, so the ground feels like the stone in the photos.
- Photos carry their own grain and share their black point with `surface` (`#0a0f1b`), so they melt into the page without a visible box.

## Motion

Calm, fast, soft: better animation, not more. Full rules: `.claude/skills/drakon-motion/SKILL.md`; tokens in `web/src/index.css`.

| Moment | Values |
| --- | --- |
| Press, hover, colour, border fills | `duration-fast` 150ms; buttons scale to 0.97 on press |
| Menus, chips, cart count pop, "Added" check | `duration-base` 250ms |
| Page change (fade + 8px rise), product photo flying into its page, sheets, image fade-in, home hero reveal, photo hover zoom to 1.03 | `duration-slow` 400ms |
| Easing | entering `cubic-bezier(.2,.7,.2,1)` (`ease-out-drakon`), leaving `cubic-bezier(.4,0,1,1)` (`ease-in-drakon`) |
| Lists (shop grid, archive) on first load | first 6 items rise, 40ms apart |

- Never over 500ms. Only `transform` and `opacity` move (and the glass header's blur). Nothing may shift the layout.
- No floating, spinning, shimmer or pulse loops, parallax, counters, bounce or cards that lift.
- Under `prefers-reduced-motion`, drop all movement; fades stay at 150ms or less.

## States

- **Hover:** `accent` fills become `accent-hover`. Secondary buttons and nav links get a `field` fill and `ink-strong` text. Product photos zoom slowly.
- **Focus:** a 2px `focus` outline with a 2px offset on every interactive element.
- **Disabled:** 40% opacity and no hover change.
- **Selected** (size, payment, delivery zone): `ink-strong` 1px edge plus a filled `field` background.
- **Unavailable size:** dashed `line` edge, the size in `ink-subtle` with a thin diagonal line through the button (not a struck letter), and "Sold out" in its accessible name.
- **Sold out:** grayscale photo at 60% opacity, a "Sold out" badge, the price struck through in `ink-subtle`, no buy button. Sold-out products stay visible in the Sold Out archive; never hide them.

## Photography

Every image follows one recipe so the shop looks like one shoot:

- **Set:** top-down flat lay on dark honed slate. One product (or one product family) per frame, centred or a third in, with generous dark space.
- **Light:** one warm key light (about 3200K) from the upper left at a low angle (about 20°), so shadows fall long and soft to the lower right. A cool, weak fill from the opposite side. A big soft box overhead gives foil and gloss their sheen.
- **Materials:** matte and real: brushed card stock, fleece, leather seams, satin plastic. No mirror gloss, no plastic-toy shine.
- **Colour:** blacks lifted to `surface` (#0a0f1b); warm highlights; no other colour casts. Orange appears only where the product itself is orange.
- **Collection tiles:** a close-up of material from that collection (foil edge, panel seam, rotor guard, fleece and woven tag), so a page never shows the same shot twice.
- **Thumbnails:** a square crop where the product fills about 85% of the frame, exposure lifted about a third of a stop so it reads at 56px.
- **Sizes:** product photos 1:1 (1000–1200px), collection tiles 4:5 (800×1000), archive 4:3 (1000×750), hero 1680×880 desktop and 900×1125 phone, thumbnails 240px. WebP, 200 KB at most.
- **Never:** people, rooms, fake lifestyle scenes, other brands' logos or characters, mock-ups that look like renders of renders.
- **Sold out:** same photo, grayscale in CSS. Never reshoot for the archive.
- An empty image well is `field` with a `caption` in `ink-muted`.

## Iconography

Lucide-style stroke icons, 1.75 stroke: 16px inside buttons, 20px standalone. Icons take the colour of the text they sit with. Use them only where they carry meaning (cart, search, menu, phone, lock); no decorative icon rows.

## Logo

There is no logo file yet. Until one exists, the mark is a `logo-mark` square with `radius-xl` corners filled with `accent`, holding a 700-weight "D" in `on-accent`, followed by "Drakon" in 20px Outfit 600, `ink-strong`, tracking -0.02em, `space-2` apart. Use the mark once per page (header) and once in the footer, never as decoration. The ember eye drawn on the products is product art, not the logo.

## Not synced

Taken from the `website for Drakon` folder: `tailwind.config.ts`, `layout.tsx` and the home components, then refreshed to the Ember Gallery direction (12 Oct 2026) and refined with gallery labels, one type scale, the Taka font and a stricter accent budget (13 Oct 2026). Left out on purpose:
- the light theme
- amber, purple, red and emerald accents
- gradients and coloured glows
- the float, spin and shimmer animations
- the reward-points box on product cards (rewards come later)

Fonts are Google-hosted, so there are no font files here. The components are hand-written static renditions, not built from the code. Product photos live in the DRAKON Screens canvas (`project/img/`).
