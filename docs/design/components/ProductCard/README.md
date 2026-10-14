# ProductCard

The product tile in every grid. There is no box: a 1:1 photo with `radius-2xl` corners, then a flat gallery label (name, a plain line on what it is, a hairline, price and stock fact) straight on `surface`, so the photo is the card.

- **Label:** name in `title` (`ink-strong`); one line in `caption` (`ink-muted`) saying what it is and whether it is limited ("Tech toy, limited run", "Sports toy, restocks"); a `line` hairline; price in `price` with tabular figures (`ink-strong`, not orange) and the stock fact in `figure` (`ink-muted`).
- **Limited:** said in the label line, not with a badge on the photo. Photos stay clean.
- **Low stock:** the stock fact states the count ("Only 3 left").
- **Add to cart:** a round 44px glass button (`dk-card__add`) bottom-right on the photo (photo and button share a `dk-card__frame`), with a plus icon and an `aria-label` that names the product. It fills with `accent` on hover. The full "Add to cart" button lives on the product page.
- **Sold out** (`dk-card--soldout`):
  - the photo turns grayscale at 60%
  - a Sold out badge sits top-left on the photo
  - the price is struck through in `ink-subtle`
  - the fact reads "Sold out"
  - there is no add button
- **Hover:** the photo zooms to 1.03 over 700ms. The card never lifts and gains no border.
- **Empty image:** `dk-card__well` shows a `caption` on `field` until the photo loads.

What you provide: a square photo shot to the Photography rules, with alt text; the name (one line); the category and the limited flag; the price already formatted by the server (`৳1,250`); the stock state; a link to the product page around the photo and name.

**Do:**
- Use 2 columns on phones, 3 from 640px, 4 from 1024px, with `space-10` column gaps and `space-16` row gaps.
- Let the whole photo and title link to `/products/[slug]`.

**Don't:**
- Put the card in a box, add a border or a shadow.
- Show prices calculated in the browser, or orange prices.
- Hide sold-out products.
- Add a reward-points box (rewards come later).

Hand-written from `src/components/home/FeaturedProducts.tsx` and `SoldOutSection.tsx`, refreshed for the Ember Gallery direction and its gallery labels. See GalleryLabel.
