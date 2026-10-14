# GalleryLabel

The small label that sits with a product like a museum wall label: name, what it is, price and the stock fact. It is DRAKON's one memorable element; keep everything around it quiet.

- **Over a photo** (`dk-glabel`): `label-width` wide, `surface-glass` with a 20px blur, a `line` edge, `radius-2xl` and `shadow-label`. Used once per page, on the home hero, bottom right of the photo. Make the whole label a link to the product.
- **Flat** (`dk-glabel dk-glabel--flat`): the same content with no box, under a product photo in grids and in the product page buy box.
- **Sold out** (`dk-glabel--soldout`): price struck through in `ink-subtle`, the fact reads "Sold out".
- **Content, in order:** `dk-glabel__name` (one line), `dk-glabel__meta` (one plain line: "Playcard set, limited run" or "Sports toy, restocks"), then a hairline row with `dk-glabel__price` (tabular figures) and `dk-glabel__fact` ("12 left", "Only 3 left").

What you provide: the name, the category in plain words, whether it is a limited run, the server-formatted price and the live stock fact.

**Do:**
- Keep the fact true to the database. Unknown means leave the fact out.
- On phones, place the label under the photo at full width.

**Don't:**
- Join facts with middle dots, add countdowns, or colour the price.
- Put more than one label over a photo, or a label over a product's print.
