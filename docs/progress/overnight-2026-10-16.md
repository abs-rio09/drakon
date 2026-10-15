# Overnight run 2026-10-16: database + Go API + real checkout

Written in simple English for Abu Bakkar Siddik. Nothing was pushed to GitHub. Every phase has its own local commits.

## Plan

- [x] Phase 0: start (read docs, check tools, start the database)
- [x] Phase 1: catalog schema that matches the real UI (step 4b)
- [x] Phase 2: the rest of the schema + dev seed (step 4c)
- [x] Phase 3: Go API skeleton (step 5)
- [x] Phase 4: public catalog API
- [x] Phase 5: connect the website to the API (step 6)
- [x] Phase 6: real checkout (step 7)
- [x] Phase 7: track and cancel (step 8)
- [ ] Phase 8: background sweep
- [ ] Phase 9: final quality pass

---

## Phase 0: start

- Read CLAUDE.md, docs/blueprint.md (parts 2, 5, 6, 7, 9, 10), docs/open-questions.md and the end of the 2026-10-15 log.
- `git status`: `api/db/migrations/00001_catalog.sql` and the `.env.example` change were not committed yet.
- `goose status` said `Pending -- 00001_catalog.sql`. So 00001 was **never applied**, and I am allowed to edit it directly (Phase 1).
- `docker compose up -d db` → the container `drakon-db-1` was already running and **healthy** (PostgreSQL 18).
- Tools:
  - Go 1.27.1 ✅
  - goose v3.29.0 ✅ (in `$(go env GOPATH)/bin`, which is `~/go/bin`; it is not on your PATH, see the note below)
  - sqlc was missing → installed with `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` → v1.31.1 ✅
  - `psql` is not installed on your PC. I use the one inside the container: `docker compose exec db psql -U drakon -d drakon`. No sudo needed.

**Note for you:** add Go tools to your PATH once, so `goose` and `sqlc` work in every terminal:

```zsh
echo 'export PATH="$PATH:$(go env GOPATH)/bin"' >> ~/.zshrc && source ~/.zshrc
```

---

## Phase 1: catalog schema that matches the real UI

### What I built
- `api/db/migrations/00001_catalog.sql` (edited, because `goose status` showed it was never applied). It now holds everything the web catalog types use:
  - `categories.image_url` (the collection tile photo)
  - `products`: `kind`, `variant_kind`, `summary`, `story` (a list of paragraphs, `TEXT[]`), `edition_size`, `successor_id` (the newer edition), `featured_order` (place in "The current drop")
  - a new table `product_details` (term / text pairs, in order)
  - `product_images`: `thumb_url`, `short_name`
  - `product_variants`: `note`, `image_index`, `sort_order`
- `.env.example`: the goose keys (`GOOSE_DRIVER`, `GOOSE_DBSTRING`, `GOOSE_MIGRATION_DIR`).

### Why
The website already shows these fields from mock data. If the database could not hold them, the pages would lose content when we switch to the API in Phase 5.

### Key concepts
- **Migration** = a numbered SQL file that changes the database. `-- +goose Up` is how to apply it, `-- +goose Down` is how to undo it. goose remembers which files ran in a table called `goose_db_version`.
- **Why not edit an applied migration?** Your PC (and later Neon) already ran it. Editing the file does not re-run it, so the databases would differ. That is why a change after "applied" always goes in a new file.
- **`TEXT[]`** is a Postgres array: one column holding a list of texts (the story paragraphs).
- **Separate table for details** instead of one big text: each row is one term/text pair with a `sort_order`, so the admin can later edit one row.
- **`UNIQUE` on `featured_order`**: two products can never claim spot 1. NULL is allowed many times (= not featured).
- **`CHECK (successor_id <> id)`**: a product cannot be its own newer edition.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon
export PATH="$PATH:$(go env GOPATH)/bin"
goose status                         # 00001 ... applied
docker compose exec db psql -U drakon -d drakon -c '\dt'
docker compose exec db psql -U drakon -d drakon -c '\d products'
```
I ran `goose up`, `goose down`, `goose up` again: all three worked.

### Decisions and questions
- I used a separate `product_details` table (not JSONB). It is easier to read in psql and to edit one row from the admin later.
- The "hero" product under the home gallery label (`dragon-flame-playcard-set`) is stored as a setting (`home_hero_product_slug`, Phase 2), because it is one value for the whole site, not a product field.

---

## Phase 2: the rest of the schema + dev seed

### What I built
- `api/db/migrations/00002_settings_delivery.sql`
  - `settings` (key, JSONB value, description, updated_at) with the starting values: cod_confirm_hours 48, default_purchase_limit 5, return_days 3, archive_after_days 7, free_delivery_enabled false, low_stock_threshold 5, gift_note_max_chars 150, courier_note_max_chars 200, and home_hero_product_slug.
  - `delivery_zones`: INSIDE_DHAKA 6000 paisa (৳60), OUTSIDE_DHAKA 10000 paisa (৳100). `free_over_paisa` is empty (never free) for now.
  - `delivery_areas`: 65 rows = all 64 districts. Dhaka has two rows: "Dhaka city" (INSIDE_DHAKA) and "Outside Dhaka city" (OUTSIDE_DHAKA). Every other district has one row, OUTSIDE_DHAKA.
- `api/db/migrations/00003_orders.sql`: `orders`, `order_items`, `order_status_history`, `payments`, `blocked_phones`, `inventory_movements`, `product_events`, plus Postgres enums for every status list.
  - `orders` stores every checkout field (name, phone, email, district, the Dhaka city/outside choice as `district_area`, area, address, courier note, gift receiver name/phone/note, hide prices) and the money snapshots (zone code, delivery charge, subtotal, total, currency). No `customer_id` (accounts not decided).
- `api/db/seed/dev_seed.sql` + `api/Makefile` target `make seed`: the same 4 categories and 10 products as the website mocks (including the SOLD_OUT and ARCHIVED ones, the featured order and the Hoodie 01 → 02 successor link).

### Why
- Business numbers must live in the database (CLAUDE.md hard rule 3), so the admin can change them later without a code change.
- Orders need a place to live before Phase 6 can create them.
- The seed makes the site look exactly like before, but now the data comes from PostgreSQL.

### Key concepts
- **Enum** (`CREATE TYPE order_status AS ENUM (...)`): a column that only accepts a fixed list of words. `'SHIPED'` (typo) is refused by the database.
- **CHECK constraint**: a rule the database checks on every insert/update. Examples here:
  - `total_paisa = subtotal_paisa + delivery_paisa` (the total can never be wrong)
  - `line_total_paisa = unit_price_paisa * qty`
  - a gift must have the receiver's name and phone
  - a cancelled order must have `cancelled_at` and `cancel_reason`
  - the phone must look like `01XXXXXXXXX`, and the order number like `DRK-7K3Q9P`
- **Foreign key** (`REFERENCES orders (id)`): an order item can only point to an order that exists, and the order cannot be deleted while items point to it.
- **Snapshot**: `order_items.product_name` and `unit_price_paisa` are copies. If the product name or price changes next month, old orders still show what the buyer really paid.
- **JSONB**: a column that stores JSON. `settings.value` can be `48`, `false` or `"text"` in the same column.
- **Index**: like the index at the back of a book. `orders (phone)` makes "find this phone's orders" fast (purchase limit check).
- **Idempotent seed**: "safe to run twice". `ON CONFLICT (slug) DO NOTHING` = if a row with this slug exists, skip it. The second `make seed` printed only `INSERT 0 0` lines (0 new rows).

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make seed            # run it twice, the second time nothing changes
docker compose exec db psql -U drakon -d drakon
```
Inside psql, try the guards (each one must fail):
```sql
UPDATE product_variants SET stock = -1 WHERE sku = 'DRN-01';
-- ERROR: ... violates check constraint "product_variants_stock_check"
UPDATE product_variants SET price_paisa = -100 WHERE sku = 'DRN-01';
-- ERROR: ... violates check constraint "product_variants_price_paisa_check"
INSERT INTO products (category_id, slug, name, kind)
  SELECT id, 'night-striker-football', 'Copy', 'Sports toy' FROM categories WHERE slug = 'sports-toys';
-- ERROR: duplicate key value violates unique constraint "products_slug_key"
UPDATE product_variants SET stock = stock - 5 WHERE sku = 'DRN-01' AND stock >= 5;
-- UPDATE 0   <- only 3 in stock, so 0 rows change. This is how checkout knows "out of stock".
```
I ran exactly these; all three errors appeared and the last one changed 0 rows.

### Decisions and questions
- The seed **never overwrites** rows. After you place test orders, `make seed` will not reset the stock. (To reset you would need to wipe the dev DB, which I am not allowed to do; ask me if you want a reset script.)
- Non-Dhaka districts have one area row whose label is the district name. The website asks "Dhaka city or outside?" for **any** district that has more than one area row, so the admin can later split another district (e.g. Chattogram city) without a code change.
- `product_events.by_admin_id` has no foreign key yet, because the `admins` table comes with admin login (later).
- The seed gives sold-out dates at 12:00 Dhaka time. Founders Deck (2026-09-21) and Mini Goal (2026-09-02) are SOLD_OUT for more than 7 days, so the Phase 8 sweep will move them to ARCHIVED. The archive page shows both statuses, so the site looks the same.

---

## Phase 3: Go API skeleton

### What I built
- `api/go.mod`, module `github.com/abs-rio09/drakon/api`. Dependencies: only `pgx/v5` and `goose/v3` (goose builds the test database). Their own small helper packages come with them.
- `api/cmd/server/main.go`: reads config, opens a pgx **pool**, logs with `log/slog`, sets server **timeouts**, and does a **graceful shutdown** on Ctrl+C.
- `api/internal/config`: reads `DATABASE_URL` and `PORT` (default 8080). A tiny `.env` reader for local dev (looks in `api/.env`, then `../.env`). Real environment variables win.
- `api/internal/httpapi`: the router (standard `net/http` `ServeMux` with patterns like `GET /api/health`), JSON helpers, error middleware.
  - Every error is `{"error":{"code":"UPPER_SNAKE","message":"..."}}`. Form errors also have `"fields": {"phone": "..."}`.
  - Request bodies: max 1 MB, unknown fields rejected (`UNKNOWN_FIELD`), only one JSON object.
  - Crashes (panics) and database errors become a plain `500 INTERNAL`. The details go only to the server log, never to the browser.
  - The request log line has method, path, status, time. It never logs bodies (no phone numbers or addresses in logs).
- `GET /api/health` → `{"status":"ok","database":"ok"}` (pings the database; 503 `DATABASE_DOWN` if it can't).
- sqlc: `api/sqlc.yaml`, queries in `api/db/queries/`, generated code in `api/internal/db/` (committed).
- `api/internal/testdb`: creates `drakon_test` in the same container (only if missing), wipes **only** that database and runs all migrations. It refuses any database whose name does not end in `_test`.
- `api/Makefile`: `db-up`, `migrate`, `migrate-status`, `seed`, `sqlc`, `run`, `test`, `check`.
- `.env` got `DATABASE_URL` and `PORT` (with the same password as before; not printed anywhere). `.env.example` shows the keys with `change-me`.

### Why
Every later phase (catalog, checkout, track) plugs into this skeleton. Doing timeouts, error shape and shutdown once, at the start, means no handler can forget them.

### Key concepts
- **Connection pool** (`pgxpool`): opening a database connection is slow, so the pool keeps a few open and lends one to each request.
- **ServeMux patterns** (Go 1.22+): `mux.HandleFunc("GET /api/products/{slug}", h)`; inside the handler `r.PathValue("slug")` gives the slug. The most specific pattern wins, so `/api/products/featured` beats `/api/products/{slug}`.
- **Graceful shutdown**: on Ctrl+C the server stops accepting new requests but lets running ones finish (up to 10 s), then closes the pool. A checkout in the middle of its transaction is not cut in half.
- **Timeouts**: without `ReadHeaderTimeout` a slow client could keep a connection open forever.
- **sqlc**: you write plain SQL with a name comment (`-- name: ListCategories :many`), run `make sqlc`, and get a typed Go function `q.ListCategories(ctx)`. No ORM, and the SQL is checked against the real schema.
- **`errors.As`**: Go's way to ask "is this error (or something it wraps) an `*apiError`?".

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make run                       # in one terminal
curl -s localhost:8080/api/health      # in another: {"database":"ok","status":"ok"}
curl -s localhost:8080/api/nope        # {"error":{"code":"NOT_FOUND",...}}
# Ctrl+C in the first terminal: you see "shutting down" then "bye"
make check                     # gofmt + go vet + go test
```
I ran exactly this: health 200, unknown path JSON 404, Ctrl+C printed `shutting down` and `bye`.

### Decisions and questions
- A wrong method on a known path (e.g. `POST /api/health`) gets the JSON 404, not 405. Simple and harmless; tell me if you prefer 405.
- Test packages take turns using `drakon_test` with a Postgres **advisory lock**, so `go test ./...` is safe even though Go runs packages in parallel.

---

## Phase 4: public catalog API

### What I built
| Endpoint | Answer |
|---|---|
| `GET /api/categories` | `{"categories":[{slug,name,image}]}` |
| `GET /api/products?category=&q=&limit=&offset=` | ACTIVE products only. `q` searches name and kind (any case). `limit` 1–100 (default 24), `offset` 0–10000. Answer: `{products,total,limit,offset}` |
| `GET /api/products/featured` | "The current drop" in `featured_order`, plus `hero` (the product under the home gallery label) |
| `GET /api/products/{slug}` | `{product, related}`. A DRAFT product answers 404, exactly like an unknown slug |
| `GET /api/sold-out` | SOLD_OUT + ARCHIVED, the most recent first |
| `GET /api/delivery/areas` | `{zones, districts:[{name, areas:[{id,label,hint,zoneCode}]}], freeDeliveryEnabled}` |
| `GET /api/settings/public` | codConfirmHours, defaultPurchaseLimit, returnDays, lowStockThreshold, giftNoteMaxChars, courierNoteMaxChars, currency |

- `api/internal/catalog`: turns database rows into the JSON shape of the website's `Product` type.
- `api/internal/settings`: reads the settings table. **No fallback numbers in code**: if a setting is missing, the API answers 500 and logs which key is missing.
- 11 integration tests (`api/internal/httpapi/catalog_test.go`) against `drakon_test`.

### Why
This is what the website needs to stop using mock files (Phase 5). The JSON field names (`pricePaisa`, `variantKind`, `successorSlug` ...) are the same as the TypeScript types, so the switch is small.

### Key concepts
- **Query string**: the part after `?` in a URL: `/api/products?category=clothes&limit=2`. Go reads it with `r.URL.Query().Get("limit")`.
- **Bounded pagination**: `limit` can never be more than 100, so nobody can ask for a million rows and slow the server.
- **ILIKE + escaping**: `ILIKE '%hoodie%'` means "contains hoodie, any case". `%` and `_` are wildcards, so the search text is escaped first: searching `100%` looks for the real text "100%".
- **The N+1 problem** (and how we avoid it): loading 20 products one by one with their images and variants would be 1 + 20×3 queries. `LoadProducts` uses `WHERE product_id = ANY($1)` and does **4 queries in total**, however many products.
- **httptest**: Go's standard way to call a handler in a test without a real network: `httptest.NewRequest` + `httptest.NewRecorder`.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make run     # terminal 1
# terminal 2:
curl -s localhost:8080/api/categories
curl -s 'localhost:8080/api/products?category=clothes'
curl -s 'localhost:8080/api/products?q=hoodie'
curl -s localhost:8080/api/products/dragon-flame-card-edition-01
curl -s localhost:8080/api/sold-out
curl -s localhost:8080/api/settings/public
curl -s 'localhost:8080/api/products?limit=500'     # 400 BAD_QUERY
make test
```
I ran these against the dev database: 4 categories, featured = card, hoodie 02, drone, football; hero = playcard set; 64 districts; settings 48/5/3/5/150/200.

### Decisions and questions
- `GET /api/products` returns full products (with variants and images), because the product cards need price and stock. With 10 products that is small. Later, with hundreds, we can add a lighter "card" shape.
- Search covers ACTIVE products only (as the prompt says). The old mock search also showed sold-out runs. Tell me if the search page should include the archive.
- `related` (4 products under the product page) is now computed on the server: same category first, then others.

---

## Phase 5: connect the website to the API

### What I built
- `web/vite.config.ts`: dev proxy `/api` → `http://localhost:8080` (the `/api` prefix is kept).
- `web/src/lib/types.ts`: the TypeScript shapes of the API answers (moved out of the old mock file). Ids are now **numbers** (database ids) instead of text like `"v-df-paper"`.
- `web/src/lib/api.ts`: small typed helpers (`getProducts`, `getProduct`, `postQuote` ...). Every error answer becomes an `ApiError` with `status`, `code`, `message` and `fields`. A network failure becomes code `NETWORK` with a friendly message.
- `web/src/lib/useApi.ts`: a tiny hook that gives a page `loading` / `error` / `ready`, remembers the last answer (coming back to a page is instant) and fetches a fresh one.
- `web/src/components/ui/LoadState.tsx`: the quiet loading line, grey skeleton tiles for product grids, and an error message with a "Try again" button.
- `web/src/features/site/SiteProvider.tsx`: loads `/api/settings/public` and `/api/delivery/areas` once when the site opens ("Opening the shop…"). Every page reads business numbers from there (`useSite()`), never from code.
- Cart and checkout: `useCartQuote()` asks `POST /api/checkout/quote` for prices every time the cart or the delivery area changes. **The browser never adds up prices any more**; the subtotal, delivery and total on screen are the server's numbers.
- Old carts: lines with old text ids are dropped when the cart loads; ids the server does not know are removed quietly; a quantity above stock/limit is lowered.
- Checkout: districts and the "Dhaka city / outside" choice come from `delivery_areas`. Any district with more than one area asks the question (no `if district === 'Dhaka'` in code).
- Deleted `web/src/mocks/catalog.ts`, `delivery.ts`, `settings.ts` and `features/checkout/deliveryQuote.ts`. `mocks/contact.ts` stays (site content).

**Moved forward:** `POST /api/checkout/quote` (planned for Phase 6) was built at the start of this phase, because the cart page needs server prices to show anything.

### Why
Hard rule 1: the server decides money. Now the site shows exactly what is in PostgreSQL, and the numbers on the checkout page are the same ones the order will use.

### Key concepts
- **Proxy**: the browser asks Vite (`localhost:5173/api/products`), Vite asks Go (`localhost:8080/api/products`) and passes the answer back. The browser sees one site, so no CORS problems and (later) cookies work.
- **`fetch` + `async/await`**: `await fetch(url)` waits for the answer without freezing the page.
- **Loading / error / ready states**: every request can be slow or fail, so every page that loads data shows one of three things.
- **React context** (`SiteProvider` + `useSite()`): data that many components need, given once at the top instead of passed through every component.
- **AbortController**: when the cart changes quickly, the older quote request is cancelled, so an old answer can never overwrite a newer one.

### How to test it yourself
```zsh
# terminal 1
cd ~/Desktop/projects/Drakon/drakon/api && make run
# terminal 2
cd ~/Desktop/projects/Drakon/drakon/web && npm run dev
```
Then open http://localhost:5173 and walk: Home → Shop → Clothes → a product → Add to cart → Cart → Checkout → pick Dhaka → pick Dhaka city: delivery shows ৳60 and the total changes.
Stop the Go server (Ctrl+C) and reload: you see "We could not reach the shop…" / "The shop is not answering…" with **Try again**. Start it again and press Try again.

**How I checked (exactly):**
1. `curl` through the Vite proxy: `/api/health`, `/api/categories`, `/api/products`, `/api/products/featured`, `/api/products/ember-night-hoodie-edition-02`, `/api/sold-out`, `/api/delivery/areas`, `/api/settings/public` → 200; `/api/products/nope` → 404.
2. In Chrome I visited all 17 routes (`/`, `/shop`, `/shop/clothes`, `/shop/nope`, two products, `/product/nope`, two searches, `/sold-out`, `/cart`, `/checkout`, `/track`, `/about`, `/contact`, two policies) and read the page text: real data everywhere; unknown collection/product show "Page not found".
3. Cart test: I saved a cart with an old text id, an unknown id (9999), a sold-out variant, 2 hard paper cards and 9 drones. Result: the old and unknown ids were removed, the drone went down to 3 (stock), the sold-out key-ring was listed as "sold out", and the summary showed the server subtotal.
4. Checkout: choosing Dhaka showed the city/outside choice; choosing Dhaka city made delivery ৳60 and the total ৳11,160 (from the server).
5. `npm run build` and `npm run lint`: 0 errors, 0 warnings.

**A real bug that test 3 found:** the out-of-stock key-ring was counted towards the card's purchase limit of 2, so "2 hard paper" was wrongly refused. Fixed in the API (only buyable lines count) with a regression test.

### Decisions and questions
- If the API is down, the whole site shows the "Opening the shop…" screen and then an error with **Try again** (even About and policies, because they show settings numbers). Honest, and simple. On Render's free plan the first visit after a sleep can take 30–60 s, so the loading text says "Opening the shop…".
- The header cart bubble counts all lines in the cart (no request on every page). A sold-out line counts until you remove it on the cart page.
- Git note: the deletion of the three mock files landed in commit `eda1ba6` (the api limit fix) instead of the web commit, because I had staged it early. I did not rewrite history (not allowed); the code is correct either way.

---

## Phase 6: real checkout (the most important phase)

### What I built
**`POST /api/checkout/quote`** (built in Phase 5, see there): cart + area → items, problems, subtotal, delivery, total. Prices only from the database.

**`POST /api/orders`** (`api/internal/orders/place.go`), Cash on Delivery only:
1. Validate every field with the same rules and messages as `validation.ts` (`api/internal/orders/validate.go`): name, phone (+880 / 880 / spaces / dashes cleaned), optional email, delivery area must exist, area, address, courier note and gift note lengths (counted in letters, so Bangla works), gift receiver name and phone when it is a gift. Gift fields are thrown away if "This is a gift" is not ticked. Bad fields → `422 VALIDATION` with `fields`.
2. Then **one transaction**:
   - lock this phone number (`pg_advisory_xact_lock`), so two orders from the same phone at the same moment are checked one after the other
   - blocked phone → `403 PHONE_BLOCKED`
   - price everything from the database, counting this phone's earlier non-cancelled orders towards `purchase_limit` (or `default_purchase_limit`) → `409 PURCHASE_LIMIT` / `OUT_OF_STOCK` / `UNAVAILABLE`, with `problems`
   - for each item, in variant-id order: `UPDATE product_variants SET stock = stock - $qty WHERE id = $id AND stock >= $qty`. 0 rows → roll back, `409 OUT_OF_STOCK` naming the item
   - order row with a random `DRK-XXXXXX` number (retry if taken), the SHA-256 of a 32-byte track token, all form fields, and the money snapshots
   - `order_items` (snapshots of name, variant label, unit price), `inventory_movements` (ORDER, −qty)
   - `order_status_history` (→ PENDING, by CUSTOMER) and `payments` (COD, PENDING, total)
   - a limited product with every variant at 0 becomes SOLD_OUT (`sold_out_at` + `product_events` row). A non-limited product stays ACTIVE ("Out of stock").
3. Answer `201` with `orderNumber`, `trackToken` (raw, **only this once**) and the order view (no name, phone or address in it).

Delivery charge: from the zone; if `free_delivery_enabled` is true **and** the zone has `free_over_paisa` **and** the subtotal reaches it, the charge is 0.

**Frontend**
- "Place order (Cash on Delivery)" works (button in the summary and in the phone bar, both connected to the form). A second tap while sending is ignored. Server field errors show under the fields; a refused order shows the server's message and refreshes the cart quote.
- `/order/:number`: "Thank you. Your order is placed.", the number with a **Copy** button, "What happens next" (call within 48 h, ship, pay ৳X in cash), the items and total. Right after ordering it also shows "Deliver to" (kept only in memory, never saved).
- The browser remembers only `{orderNumber, token, placedAt}` in localStorage (`drakon.orders.v1`), never personal data.

### Tests (all pass, also with `go test -race`)
| Test | What it proves |
|---|---|
| `TestPlaceOrderHappyPath` | order row (normalized phone, trimmed email, Dhaka city, gift fields), snapshots, stock −1/−2, stock book, history, COD payment, raw token not stored |
| `TestPlaceOrderOutOfStock` | 4 drones with 3 in stock → 409 naming the drone; **nothing** changed (the ball in the same cart kept its stock) |
| `TestPlaceOrderRaceForLastItem` | **10 goroutines** order the last drone at the same moment: exactly 1 wins, stock ends at 0, 1 order, drone becomes SOLD_OUT |
| `TestDecrementStockGuardWithTwoTransactions` | step by step: transaction 2 waits for transaction 1's row lock, then changes 0 rows |
| `TestPlaceOrderPurchaseLimitAcrossOrders` | card limit 2: 1 + 2 refused, 1 + 1 fine; another phone has its own limit; default limit 5 |
| `TestPlaceOrderCancelledOrdersDoNotCountTowardsLimit` | cancelled orders free the limit again |
| `TestPlaceOrderLimitRaceSamePhone` | same phone, two orders at once for the full limit → one 201, one 409 |
| `TestPlaceOrderBlockedPhone` | 403, stock unchanged (also when typed as +880…) |
| `TestPlaceOrderIgnoresClientPrices` | a `pricePaisa`/`totalPaisa` sent by the browser is refused (`UNKNOWN_FIELD`); a normal order pays the database price |
| `TestPlaceOrderSetsSoldOut` | limited hoodie → SOLD_OUT + event + moves to the archive; non-limited football at 0 stays ACTIVE; card with stock left stays ACTIVE |
| `TestPlaceOrderValidation` | every field error; 150 Bangla letters OK, 151 refused; unknown area |
| `api/internal/orders/orders_test.go` | order number pattern (2000 numbers), token/hash, phone cleaning, line merging |

### Key concepts
- **Transaction** (`BEGIN … COMMIT`): a group of SQL statements that happens completely or not at all. If anything fails in the middle (the 3rd item is out of stock), `ROLLBACK` undoes the stock already taken for items 1 and 2. In Go: `pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error { … })`; returning an error rolls back.
- **Row lock**: an `UPDATE` locks the row until the transaction ends. A second buyer's `UPDATE` on the same row waits, then sees the new stock. Together with `AND stock >= $qty` this makes overselling impossible.
- **Advisory lock**: a lock on a made-up number (here: the hash of the phone). Used where there is no single row to lock (the purchase limit is a sum over many orders).
- **Deadlock** and why we sort: if order A locks variant 1 then 2, and order B locks 2 then 1, both wait forever. Always locking in id order prevents that.
- **Hashing the token**: SHA-256 is one-way. The database keeps the hash; to check a token we hash it again and compare. A leaked database cannot be used to cancel orders.
- **crypto/rand vs math/rand**: crypto/rand cannot be predicted, so order numbers cannot be guessed.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api && make test
# browser: add something to the cart, check out with any test name and phone 017XXXXXXXX, place the order
docker compose exec db psql -U drakon -d drakon -c "SELECT order_number, status, total_paisa FROM orders"
```
**How I checked in the browser:** cart with 1 hard paper card + 2 sleeve boxes, Sylhet → subtotal ৳1,150 + delivery ৳100 = ৳1,250. Clicked Place order → `/order/DRK-PBLMQQ` with Copy button. In the database: 1 PENDING order, total 125000, paper stock 22→21, sleeves 48→46, two ORDER rows in the stock book; localStorage held only the number + token; the cart was empty. (Earlier, a cart with an out-of-stock tee kept the button disabled with "Some items need a change".) This test order is still in your dev database: `DRK-PBLMQQ`, phone 01700000001.

### Decisions and questions
- **Purchase limit is per product** (all variants together), as the blueprint says. The product page still caps each variant separately, so a buyer can put 2 paper + 2 metal (limit 2) in the cart; the cart then shows "The limit is 2 per customer" and checkout is blocked until they lower it. Tell me if the limit should be per variant instead.
- The order view (track/confirmation) never contains name, phone, email or address.
- A wrong `deliveryAreaId` gives `422 UNKNOWN_AREA` with a `district` field error.

---

## Phase 7: track and cancel

### What I built
- **`POST /api/orders/track`** with `{orderNumber, phone}` or `{orderNumber, token}` → `{order}`: status, timeline, items, totals, `canCancel`, `confirmBy`. No name, phone, email or address. A wrong number, a wrong phone, a wrong token and a badly shaped number **all get the same** `404 ORDER_NOT_FOUND` message. The number can be typed in lower case and with spaces.
- **`POST /api/orders/cancel`** with the same lookup (+ optional `reason`, max 200 letters): only while PENDING or CONFIRMED (otherwise `409 CANNOT_CANCEL`). In one transaction:
  - lock the order row (`SELECT … FOR UPDATE`) and check the status again
  - CANCELLED, `cancelled_at`, `cancel_reason` ("Cancelled by the buyer: …"), a history row (by CUSTOMER)
  - stock back for every item + `inventory_movements` (CANCEL, +qty)
  - a SOLD_OUT product with stock again → ACTIVE (`sold_out_at` cleared, `product_events` REACTIVATE). ARCHIVED stays archived (only the owner may bring it back, blueprint rule 9).
- `orders.CancelLocked`: the cancel steps above, shared with the Phase 8 auto-cancel.
- **Track page**: "Recent on this device" chips (one tap, uses the saved token), the lookup form, the result panel (status, "we call you before …", timeline, items, total) and a two-step **Cancel this order** → optional reason → **Yes, cancel the order** (no browser pop-ups). Coming from the confirmation page opens the order straight away.
- **Confirmation page after a reload** now finds the order with the saved token and also shows the order history.

### Why
Blueprint rule 2: the buyer cancels alone while the order has not shipped, and the stock goes back. Rule 7: tracking without an account, and the browser remembers only the number and a secret key.

### Key concepts
- **Same answer for every wrong input**: if "wrong phone" and "no such order" had different messages, someone could test random numbers to find real ones.
- **Constant-time compare** (`crypto/subtle`): comparing secrets byte by byte and stopping at the first difference leaks timing; `ConstantTimeCompare` always takes the same time.
- **`SELECT … FOR UPDATE`**: locks the order row. If the buyer cancels while the 48-hour sweep runs, one waits for the other, then sees "already CANCELLED" and does nothing. The stock can never come back twice.
- **Status machine**: only some moves are allowed (PENDING/CONFIRMED → CANCELLED). The code checks the current status before every change.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api && make test
# curl (use the number and phone of an order you placed):
curl -s -X POST localhost:8080/api/orders/track -H 'Content-Type: application/json' \
  -d '{"orderNumber":"DRK-XXXXXX","phone":"01700000001"}'
```
In the browser: place an order → on the confirmation page click **Track or cancel** → **Cancel this order** → **Yes, cancel the order**. Then check the stock in psql.

**How I checked:** reloaded `/order/DRK-PBLMQQ` (the Phase 6 test order): it loaded with the saved token and showed the history. "Track or cancel" opened it on `/track`; I cancelled with the reason "Testing the cancel flow". The database showed CANCELLED with that reason, paper stock back 21→22, sleeves 46→48, and two CANCEL rows in the stock book.

Tests (`api/internal/httpapi/track_test.go`): track by phone (also +880 form), by token, lower-case number; wrong number / phone / token / shape all identical 404; no phone → 422; cancel puts stock back and writes movements; cancelling twice is refused and does not add stock twice; wrong phone cannot cancel; token can; only PENDING/CONFIRMED can be cancelled; SOLD_OUT → ACTIVE with a REACTIVATE event; ARCHIVED stays ARCHIVED; reason too long.

### Decisions and questions
- Cancelling does not change the `payments` row (it stays PENDING, money was never collected). Later, the admin panel may want a separate "VOID" payment status. Tell me if you want that now.
- The buyer's cancel reason is optional.

