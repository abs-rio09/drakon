# Overnight run 2026-10-16: database + Go API + real checkout

Written in simple English for Abu Bakkar Siddik. Nothing was pushed to GitHub. Every phase has its own local commits.

## Plan

- [ ] Phase 0: start (read docs, check tools, start the database)
- [ ] Phase 1: catalog schema that matches the real UI (step 4b)
- [ ] Phase 2: the rest of the schema + dev seed (step 4c)
- [ ] Phase 3: Go API skeleton (step 5)
- [ ] Phase 4: public catalog API
- [ ] Phase 5: connect the website to the API (step 6)
- [ ] Phase 6: real checkout (step 7)
- [ ] Phase 7: track and cancel (step 8)
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

