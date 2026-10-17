# Overnight run 2026-10-18: the Admin panel

Written for Abu Bakkar Siddik, in simple English. Nothing in this run was pushed to GitHub.

## Plan

- [x] 0. Start: read the docs, clean git, database up, all checks pass
- [x] 1. Admin accounts and login (API)
- [x] 2. Admin shell (web)
- [x] 3. Orders admin (API + web)
- [x] 4. Products admin (API + web)
- [x] 5. Categories, settings and delivery admin
- [x] 6. Returns
- [ ] 7. Deploy-ready files (prepare only, deploy nothing)
- [ ] 8. Final review pass

---

## Phase 0: start

- Read CLAUDE.md, docs/blueprint.md (parts 2, 5, 8, 9, 10), docs/open-questions.md, docs/api.md and the decisions of the 2026-10-16 log.
- `git status`: clean, `main` is 27 commits ahead of GitHub (on purpose, not pushed).
- `make db-up`: database container healthy. `make migrate-status`: 3 migrations applied (00001–00003).
- `make check`: gofmt clean, go vet clean, all tests pass.
- Task list: the checkboxes above are my task list for tonight (this tool has no separate to-do list).

---

## Phase 1: admin accounts and login (API)

### What I built
- **Migration `00004_admin.sql`**:
  - `admins` (email unique and lower-case, `password_hash`, `role` enum with only `OWNER`, `failed_attempts`, `locked_until`, `created_at`, `updated_at`). A unique index allows **only one OWNER** (blueprint rule 8).
  - `admin_sessions` (`id_hash`, `admin_id`, `created_at`, `last_seen_at`, `expires_at`).
  - The foreign key `product_events.by_admin_id → admins`.
  - `by_admin_id` on `order_status_history` (the database refuses an `ADMIN` row without it) and on `inventory_movements`, so every admin change keeps the admin's id.
  - Two new settings: `login_max_failures = 5`, `login_lockout_minutes = 15`.
- **`api/internal/auth`**: bcrypt (cost 12), login with lockout, sessions, logout, create owner, set password.
- **Endpoints**: `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`.
- **Middleware** for every `/api/admin` path: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and the Origin check (CSRF). Then a session check for every route except login.
- **Route table** `api/internal/httpapi/admin_routes.go`: every admin route is registered from one list.
- **Config**: `COOKIE_SECURE` (default true) and `ALLOWED_ORIGINS` (default `http://localhost:5173`).
- **Sweep**: also deletes dead sessions (expired or idle too long).
- **`cmd/admin`** tool:
  - `create-owner --email <email>`: password typed hidden (x/term), at least 12 characters, asked twice. Works with any `DATABASE_URL` (Neon later).
  - `reset-password --email <email>`: new password, ends the lockout, logs out every browser.
  - `dev-owner`: **local database only** (it refuses anything that is not localhost). Makes the Owner `owner@drakon.local` with a random password and saves `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` in the repo-root `.env` (gitignored). I ran it once: **your dev password is in `~/Desktop/projects/Drakon/drakon/.env`, line `DEV_ADMIN_PASSWORD`**. I never printed it.
  - Make targets: `make dev-owner`, `make create-owner EMAIL=you@example.com`, `make reset-password EMAIL=...`.
- **Tests** (all pass): login works (cookie flags, only the hash stored), wrong password and unknown email give exactly the same answer and both take bcrypt time, lockout after 5 failures, still locked at 14 minutes even with the right password, open again after 15, the numbers come from `settings`, 12 h idle → 401, 7 days max → 401, logout kills the session (a copied old cookie stops working), bad/missing Origin → 403, only one Owner, password reset logs out, `.env` writer, dev-owner refuses a non-local database, and **the table test**: every admin route answers 401 without a session (and with a made-up cookie). That test also fails if a route is added to `admin_routes.go` but not to the test.

### Why
Nobody could confirm or ship orders. The admin is the most powerful account on the site, so it must be safe before we build anything on top of it.

### Key concepts (for a beginner)
- **Password hash (bcrypt)**: we never store the password. bcrypt turns it into a hash like `$2a$12$...`. At login we hash what you typed and compare. "Cost 12" means bcrypt is slow on purpose (~0.2 s): fine for you, very slow for someone guessing millions of passwords.
- **Session**: after a good login the server makes a random secret (32 random bytes) and gives it to your browser in a **cookie**. The browser sends the cookie back with every admin request, so the server knows it is you. The database stores only the **SHA-256 hash** of the secret: if someone steals a copy of the database, they still cannot log in.
- **Cookie flags**:
  - `HttpOnly`: JavaScript cannot read the cookie, so even a bad script on the page cannot steal it.
  - `Secure`: the browser sends it only over HTTPS. Browsers make an exception for `http://localhost`, so it works in dev too (I checked with curl).
  - `SameSite=Lax`: the browser does not attach it to requests that other websites start in the background.
  - `Path=/api/admin`: it is sent only to admin API calls.
- **Expiry**: a session ends after 12 hours without use, and after 7 days at the latest. Logout deletes the row, so the cookie becomes useless.
- **Lockout**: after 5 wrong passwords in a row, login pauses for 15 minutes (both numbers in `settings`). During the pause even the right password is refused.
- **Same answer for wrong email and wrong password**: otherwise an attacker could learn which emails have an account. For an unknown email we still run one bcrypt check against a dummy hash, so the time is about the same too.
- **CSRF (cross-site request forgery)**: a bad website could try to make *your* browser send "cancel this order" to our API, and the browser would attach your cookie. Defence: every request that changes something must have an `Origin` header (the browser fills it in, a website cannot fake it) that is on our allowed list. Otherwise 403.
- **no-store**: tells the browser and any proxy not to keep a copy of admin answers.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make migrate          # applies 00004_admin.sql (already done on your PC)
make check            # all tests
make run              # terminal 1
```
Terminal 2:
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
curl -s localhost:8080/api/admin/me                     # 401 UNAUTHORIZED
PW=$(grep '^DEV_ADMIN_PASSWORD=' ../.env | cut -d= -f2-)
curl -s -c /tmp/jar -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d "{\"email\":\"owner@drakon.local\",\"password\":\"$PW\"}" localhost:8080/api/admin/login
unset PW
curl -s -b /tmp/jar localhost:8080/api/admin/me          # {"admin":{"id":1,"email":"owner@drakon.local","role":"OWNER"}}
curl -s -b /tmp/jar -X POST -H 'Origin: https://evil.example' localhost:8080/api/admin/logout   # 403 BAD_ORIGIN
curl -s -b /tmp/jar -c /tmp/jar -X POST -H 'Origin: http://localhost:5173' localhost:8080/api/admin/logout  # {"ok":true}
```

### Decisions and questions
- **Context7 had no docs for `golang.org/x/crypto/bcrypt` or `golang.org/x/term`.** I read the official docs of the exact downloaded versions with `go doc` instead (`bcrypt.GenerateFromPassword`, `CompareHashAndPassword`, the 72-byte limit; `term.ReadPassword`, `term.IsTerminal`).
- New Go dependencies: `golang.org/x/crypto` (bcrypt) and `golang.org/x/term` (hidden password), as allowed. `golang.org/x/sys` came in as their helper.
- **A paused (locked) account gets the same answer** as a wrong password: "Wrong email or password. After 5 wrong tries in a row, login pauses for 15 minutes." A separate "locked" message would tell an attacker that the email exists. The message itself explains the pause to you.
- **COOKIE_SECURE stays true.** It works on `http://localhost` (Chrome, Firefox and curl treat localhost as secure). It would NOT work if you open the dev site from your phone at `http://192.168.x.x:5173`: then set `COOKIE_SECURE=false` in `.env` for that test only (the server prints a warning).
- **Missing `Origin` header on a change = 403**, also for login. Browsers always send it. For curl add `-H 'Origin: http://localhost:5173'`.
- Session lengths (12 h idle, 7 days max) are security constants in code, not business values, so they are not in `settings`. Tell me if you want them there.
- One Owner only, enforced by the database. A Staff role later = add a value to the `admin_role` enum.
- `dev-owner` run again = a new random password for the same dev owner (handy if you lose it).
- Your `.env` file can be read by other users on your PC (`-rw-rw-r--`). Optional: `chmod 600 ~/Desktop/projects/Drakon/drakon/.env`.

---

## Phase 2: admin shell (web)

### What I built
- **`/admin/*` routes** in `web/src/pages/admin/AdminApp.tsx`, loaded as a **separate file** (`React.lazy`): a shopper never downloads admin code. The shop's providers (settings, delivery, cart) now wrap only the shop routes, so the admin does not wait for them.
- **`/admin/login`** (`AdminLogin.tsx`), styled like the customer Sign in screen: form on the left, the hoodie-tag photo on the right (desktop only), Show/Hide password button, one error line, one orange button.
- **Auth guard** (`RequireAdmin`): asks `GET /api/admin/me`. Not logged in → `/admin/login`, and after login you go back to the page you wanted.
- **Admin layout** (`components/admin/AdminLayout.tsx`) following AdminNav.dc.html: menu on the left on desktop (logo "Drakon Admin", menu items, "Owner" + your email, Log out). On a phone: a bar on top with a **Menu** button that opens the same menu.
- **Logout**: deletes the session on the server, forgets all loaded admin data in the tab, goes to the login page.
- **Any 401 later** (session ended while you work) sends you back to the login page.
- `<meta name="robots" content="noindex, nofollow">` on every admin page (and the API sends `X-Robots-Tag: noindex`).
- No link to `/admin` anywhere in the shop (I checked the home page: 0 links containing "admin").

### Why
You need a safe door to the admin, and a frame that works on your phone, before the order screens go in.

### Key concepts (for a beginner)
- **The browser cannot see the cookie** (HttpOnly). So the web app cannot know by itself if you are logged in; it asks the server (`/api/admin/me`) when the admin opens.
- **Auth guard**: a component that sits in front of the admin pages. Not logged in → it renders `<Navigate to="/admin/login">` instead of the page.
- **Code splitting** (`lazy(() => import(...))`): Vite puts the admin into its own JavaScript file, downloaded only when someone opens `/admin`. The security is still on the server: hiding code is not protection, the session check is.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api && make run        # terminal 1
cd ~/Desktop/projects/Drakon/drakon/web && npm run dev     # terminal 2
```
1. Open http://localhost:5173/admin → you land on **/admin/login**.
2. Type a wrong password → "Wrong email or password. After 5 wrong tries in a row, login pauses for 15 minutes."
3. Log in with `owner@drakon.local` and the password from `.env` (`DEV_ADMIN_PASSWORD`) → the Dashboard.
4. Make the window narrow (or use your phone): the menu moves into the top bar.
5. **Log out** → back to the login page. Press the browser's Back button: still the login page.

### Decisions and questions
- I checked the login page in Chrome through page scripts: the guard redirect, the error message, `aria-invalid` and the `noindex` tag work. **Screenshots failed** (Chrome did not answer screenshot requests, probably because the window was not visible), so I could not look at the design with my own eyes.
- **I did not test the logged-in pages in the browser.** To do that I would have had to copy a session token into the browser, and the safety system blocked reading the token (correct: it is a credential). I ended that test session and deleted the files. Please click through the logged-in pages in the morning (checklist at the end).
- No `robots.txt` entry for `/admin`: a robots.txt line would *tell* everyone where the admin is. The `noindex` tag and header are enough.
- No "Forgot password?" email link (no email yet). The login page says to run `make reset-password` on the server.

---

## Phase 3: orders admin (the daily work)

### What I built
**Migration `00005_order_admin.sql`**: `orders.admin_note` (the "Internal note" box in the design), `blocked_phones.blocked_by_admin_id`, an index for "newest orders first".

**API** (`api/internal/orders/admin.go` = the rules, `api/internal/httpapi/admin_orders.go` = the endpoints):
- `GET /api/admin/dashboard`: orders per status, orders placed today, cash collected (DELIVERED) today and in the last 7 days. "Today" = Bangladesh time.
- `GET /api/admin/orders?status=&q=&limit=&offset=`: newest first. `q` finds the order number, the phone (typed in any format, `+880 1712-345678` works) or the buyer's name.
- `GET /api/admin/orders/call-list`: PENDING orders, oldest first, with `cancelsAt` and `minutesLeft` (from `cod_confirm_hours`).
- `GET /api/admin/orders/{number}`: everything: customer, delivery, gift, items (with SKU and photo), payments, the timeline with the admin's email, the internal note, the phone's other orders ("2 other orders: 1 delivered, 1 cancelled") and whether the phone is blocked.
- `POST /api/admin/orders/{number}/status` `{to, reason, courierName, trackingCode}`. Only these moves:
  - PENDING → CONFIRMED or CANCELLED
  - CONFIRMED → SHIPPED (courier + tracking code required) or CANCELLED
  - SHIPPED → DELIVERED (the COD payment becomes COLLECTED) or CANCELLED
  - anything else → `409 BAD_TRANSITION`; a missing reason/courier/tracking → `422`.
  - Every move is ONE transaction: the order row is locked (`FOR UPDATE`), the status changes, and a history row with `actor = ADMIN` and **your admin id** is written.
  - Every cancel reuses `CancelLocked` (the same code as the buyer's cancel and the auto-cancel): stock back with `inventory_movements` CANCEL (now with your admin id), and a SOLD_OUT product with stock again becomes ACTIVE (REACTIVATE event with your id). The buyer sees "Cancelled by DRAKON: <your reason>".
- `PUT /api/admin/orders/{number}/note` `{note}`: the internal note (never shown to the buyer).
- Blocked phones: `GET /api/admin/blocked-phones`, `POST /api/admin/blocked-phones` `{phone, reason}`, `POST /api/admin/blocked-phones/unblock` `{phone}`.
- **The sweep runs before** the dashboard, the lists, the order page and every status change (blueprint part 4). So you never see, or confirm, an order that should already be auto-cancelled.

**Web**:
- **Dashboard**: "To call today" (oldest first, time left, a `tel:` button per order), then the numbers.
- **Orders** (AdminOrders.dc.html): search, the orange attention banner ("3 orders need a call. The oldest … has 47h left." + "Call DRK-…"), status tabs with counts, a table on desktop and stacked cards on a phone.
- **Order page** (AdminOrder.dc.html): one "next step" panel per status:
  - PENDING: the phone number as a `tel:` button, **Mark as confirmed**, Cancel order.
  - CONFIRMED: courier (Steadfast / Pathao / RedX / Other) + tracking code → **Mark as shipped** (disabled until both are filled).
  - SHIPPED: **Delivered, cash collected** → a second question "Did you receive ৳410 in cash?" → Yes / Not yet.
  - Cancel always opens a form: the reason is required, and it says the pieces go back into stock and that it cannot be undone.
  - Items with "Collect in cash" and the payment state, customer and delivery (phone is a `tel:` link), gift details, history (who and when), internal note, **Block this phone number** (with a reason).
- **Blocked phones** page: list, unblock (asks once more), block a number.
- The orange bubble on **Orders** in the menu = orders waiting for a call.

### Tests (all pass, also with `go test -race`)
- Every one of the 25 from → to pairs: the 6 allowed moves work, every other one is refused and changes nothing.
- Confirm → ship → deliver: 3 history rows with the admin id, payment COLLECTED with `collected_at`, courier saved, the buyer's tracking page shows "Shipped with Steadfast, tracking code …" but **not** the admin email.
- Admin cancel from SHIPPED: stock back, CANCEL movements with the admin id, SOLD_OUT drone becomes ACTIVE with a REACTIVATE event by the admin, a second cancel is refused and adds no stock.
- Validation (no tracking code, `to: PENDING`, unknown fields, bad order numbers), an expired PENDING order cannot be confirmed (the sweep cancels it first), dashboard numbers, call list order and time left, list filters and search, internal note (hidden from the buyer), phone history, block → the order is refused → unblock → ordering works again.
- **Personal data stays out of the server log**: a test runs admin actions with a capturing logger and checks that no phone, name, address or password appears.
- The "every admin route needs a session" table now has 11 routes.

### Browser check (real clicks, Chrome)
I made a **throwaway database `drakon_ui`** (same migrations + sample catalogue) with a throwaway test owner `ui-test@drakon.test`, so your dev database and your password were never touched. Then, through the real buttons: login → dashboard (3 calls, bubble "3") → Orders (banner, tabs, table) → order page: confirm, ship (button disabled until the tracking code is filled), deliver (with the extra question), cancel another order (stock 45 → 46), save a note, block the phone, see it on Blocked phones, log out (then `/api/admin/me` = 401). At **390 px** (phone width, tested in a 390-px frame): the side menu becomes the Menu bar, the table becomes cards, nothing scrolls sideways. The server log of that run has no errors and no personal data.

### Key concepts (for a beginner)
- **State machine**: an order can only move along the arrows above. The server keeps a small table of allowed moves (`nextMoves` in `orders/admin.go`) and refuses everything else, whatever the browser sends.
- **Row lock (`SELECT … FOR UPDATE`)**: while one request changes an order, any other request that wants the same order waits. So the buyer's cancel, the auto-cancel and your click can never both happen.
- **Reuse instead of copy**: cancelling (by buyer, by the server, by you) is one function. A bug fixed there is fixed for all three.
- **`tel:` link**: on a phone, tapping it opens the dialer with the number filled in.

### How to test it yourself
See "Morning review checklist" at the end (confirm → ship → deliver, cancel and watch the stock).

### Decisions and questions
- Search also matches the **buyer's name** (the design's search box says "Order number, name or phone").
- Unblocking is `POST …/blocked-phones/unblock` with the phone in the body, not `DELETE …/{phone}`: a phone number in the URL would be written to the server log.
- A cancel by the shop shows the buyer "Cancelled by DRAKON: <reason>". Write reasons you are happy for the buyer to read.
- SHIPPED → CANCELLED also puts the stock back (the parcel comes back to you). If a parcel is **lost**, you would need a stock ADJUST afterwards (Phase 4).
- The payment row of a cancelled order stays PENDING (open question 8, VOID, is not built).
- Courier list: Steadfast, Pathao, RedX, Other (free text). Tell me if you use others.

---

## Phase 4: products admin

### What I built
**API** (rules in the new package `api/internal/products`, endpoints in `api/internal/httpapi/admin_products.go`):
- `GET /api/admin/products?status=&category=&q=`: every product in any status, with total stock, price range, cover photo and counts per status. `q` finds the name or a SKU.
- `POST /api/admin/products`: a new product, **always DRAFT** (a `status` field is refused).
- `GET /api/admin/products/{id}`: everything for the edit page, plus its record (product events), the last 30 stock-book lines, and `publishProblems` (why Publish would be refused now).
- `PUT /api/admin/products/{id}`: every field the product page shows: name, slug, category, kind, variant kind, limited yes/no, edition size, purchase limit, summary, story paragraphs, details, successor, featured order.
- Variants: `POST /api/admin/products/{id}/variants` (starts at stock 0), `PUT /api/admin/variants/{id}` (label, note, photo, order, on/off; price and SKU only while DRAFT).
- Stock: `POST /api/admin/variants/{id}/stock` `{change, reason: RESTOCK|ADJUST, note}`.
- Photos: `POST /api/admin/products/{id}/images`, `PUT /api/admin/images/{id}`, `PUT /api/admin/products/{id}/images/order`, `DELETE /api/admin/images/{id}` (removes the photo row only).
- Lifecycle: `POST /api/admin/products/{id}/publish` `{prices}`, `.../archive`, `.../reactivate` `{reason}`.
- Price fix: `POST /api/admin/variants/{id}/price-fix` `{pricePaisa, reason}`.
- `GET /api/admin/categories` (for the category select; Phase 5 adds editing).
- **No DELETE for products or variants anywhere.** A variant is turned off instead.
- Photos go through a tiny interface, `images.Store` (`api/internal/images`): `Check(address)` and `Upload(file)`. Today's `Links` store accepts `/img/<file>.webp|jpg|png|avif` or an `https://` link, and refuses uploads. For Cloudflare R2 later, write an R2 store with a real `Upload` and pass it to the server; nothing else changes.

**The rules** (each one has a test):
- New product = DRAFT, hidden from the shop (`/api/products/{slug}` answers 404).
- **Publish** (DRAFT → ACTIVE) needs at least 1 photo and 1 active variant with a price above 0, and a **limited** run also needs stock (otherwise it would be sold out the moment it goes live). The web shows a "Check the prices, then publish" screen; the API then checks that the prices you confirmed are **exactly** the prices now (if anything changed in between → `409 PRICES_CHANGED`). Writes a PUBLISH event with your id and the prices.
- **Price lock**: once the product leaves DRAFT, a variant's price and SKU cannot change (`409 PRICE_LOCKED` / `LOCKED`). Also locked once published: the web address (slug), "limited" and the edition size, because buyers rely on them.
- **Owner price fix** (ACTIVE only): needs a reason (5+ characters), writes a PRICE_FIX event with the old and new price. Orders already placed keep their price (tested: the order still says ৳1,700, a new quote says ৳1,800).
- **Stock**: every change needs a note and writes `inventory_movements` (RESTOCK or ADJUST) with your id. RESTOCK must add. Stock can never go below 0 (`409 STOCK_BELOW_ZERO`, and the database `CHECK` too). A **limited** product that is SOLD_OUT or ARCHIVED can **never** get new pieces (`409 LIMITED_NO_RESTOCK`); the UI explains why. Taking away the last pieces of a limited ACTIVE run makes it SOLD_OUT (event with your id).
- **Archive** by hand: SOLD_OUT → ARCHIVED only.
- **Reactivate** (bring back): ARCHIVED → ACTIVE only, with a written reason (10+ characters), recorded as REACTIVATE. The UI warns that a limited run that comes back can be restocked again.
- **Photos**: an address check (no `..`, no folders, no `javascript:`, https only), a description (alt) is required, the first photo is the cover. Moving or removing photos also moves each variant's "photo that shows it" number, so the Foil variant keeps showing the foil photo. A published product always keeps at least one photo.

**Web**:
- **Products** list (AdminProducts.dc.html): lifecycle tabs with counts (Active / Draft / Sold out / Archived / All), category filter, search by name or SKU, price range, stock with "Low stock" (from the `low_stock_threshold` setting), Limited / Restockable, status with a short note. Cards on a phone.
- **New product**: the form, saved as a draft; then the edit page.
- **Edit product** (AdminProductEdit.dc.html): Basics, Photos, Variants and stock (Change stock with "Add pieces / Take pieces away", why, and a live "After this: 150 in stock"), Details, Drop rules (Limited switch, edition size, purchase limit), Lifecycle (Archive now, Bring back…), Home page and archive (place in the drop, newer edition), Record (events), Stock book. Draft: **Save draft** + **Publish**. Live: **View in shop** + **Save changes**, and **Owner price fix…** per variant (warning + reason + a "I checked: the new price is ৳…" box).
- Fixed in the shop too: `formatTaka` now shows `৳2,100.50`, not `৳2,100.5`.

### Browser check (throwaway `drakon_ui` database again)
Created "Founders Playcard Deck · II" → Draft; Publish showed the two problems (no photo, no variant); added a photo, two variants (৳1,600 and ৳2,100.50), 150 pieces of stock (the stock book showed "+150 · 150 decks from the printer"); Publish showed both prices, limited and the limit; after "Yes, publish at these prices" it was Active and in the shop API; the address and the Limited switch were locked; the Owner price fix needed the checkbox, then the record showed "৳1,600 → ৳1,650 · FPD2-STD: Printer raised the paper price". At 390 px, nothing scrolls sideways.

### Key concepts (for a beginner)
- **Price snapshot**: an order copies the price into `order_items` when it is placed. Changing a product's price later never changes old orders.
- **Lock order** (to avoid a deadlock): when two transactions each hold one lock and wait for the other's, they wait forever. Postgres notices and kills one. To avoid it, stock and price changes lock the **variant first, then the product**, the same order as checkout.
- **Interface** (`images.Store`): Go's way to say "anything that has these methods". The admin code only knows the interface, so we can swap "links" for "R2 uploads" later without touching it.

### How to test it yourself
See the morning checklist ("publish a product, then try the price-fix").

### Decisions and questions
- **Price is per variant** (the database already works that way), so the design's single "Price" box became a price per variant, with the lock and the Owner fix per variant.
- **A limited run needs stock to publish.** Not in the prompt, but publishing it with 0 would make it sold out immediately. Tell me if you want to allow it.
- Locked after publish: slug, "limited", edition size, SKU. Everything else (name, story, details, category, purchase limit, featured place, successor) can still change.
- "Reactivate" on a limited run is your deliberate exception: once it is Active again, it can be restocked. That is how the blueprint describes it (Owner only, warning, reason, record).
- Removing a photo from a DRAFT is fine even if it is the last one; a live product keeps at least one.
- There is no separate "Stock" page yet (the design menu has one). Stock is changed on each product's page. A "low stock across all products" page would be a small addition later.
- Photo upload waits for Cloudflare R2. For now: copy the file into `web/public/img/` and type `/img/the-file.webp`.

---

## Phase 5: categories, settings and delivery admin

### What I built
**API** (`api/internal/httpapi/admin_catalog.go`, limits in `api/internal/settings/rules.go`):
- Categories: `GET /api/admin/categories`, `POST /api/admin/categories` `{name, slug?, image}`, `PUT /api/admin/categories/{id}` `{name, image, isActive}`, `PUT /api/admin/categories/order` `{ids}`. **Never deleted.** The address (`/shop/<slug>`) cannot change after creation, so shared links keep working. A category that still has products can be turned off.
- Settings: `GET /api/admin/settings` (every key with its value, label, min, max, unit), `PUT /api/admin/settings` `{values: {key: value}}`. **All or nothing**: one bad value and nothing is saved. Limits:

| Setting | Allowed |
|---|---|
| cod_confirm_hours | 1–168 hours |
| default_purchase_limit | 1–50 |
| return_days | 0–30 days |
| archive_after_days | 0–90 days |
| free_delivery_enabled | on / off |
| low_stock_threshold | 0–100 |
| gift_note_max_chars, courier_note_max_chars | 20–500 |
| home_hero_product_slug | a published product, or none |
| login_max_failures | 3–20 |
| login_lockout_minutes | 1–1440 |

- Delivery: `GET /api/admin/delivery` (zones, all 65 areas, free delivery on/off), `POST /api/admin/delivery/zones`, `PUT /api/admin/delivery/zones/{id}` `{name, chargePaisa, freeOverPaisa, isActive}`, `POST /api/admin/delivery/areas` `{district, label, hint, zoneId}`, `PUT /api/admin/delivery/areas/{id}` `{label, hint, zoneId, isActive}`. A zone that still has areas cannot be turned off (`409 ZONE_IN_USE`). An area cannot move to another district. A zone's code cannot change (orders keep it).
- A test checks that **every setting has a rule**, so a new setting can't be forgotten in the admin.

**Web**: **Categories** (add, rename, tile photo, on/off with a note "its products stay", move ↑ ↓), **Settings** (five groups: Orders, Checkout notes, Delivery, Home page with a product picker, Admin login; one "Save N changes" button), **Delivery** (zones with charge and "free over", free delivery on/off, new zone, every district with its areas and zones, a search box, "Split Chattogram: add an area").

**The shop shows new values at once**: the Go API reads the tables on every request (nothing is cached on the server), and the website asks the API when a page opens. No rebuild, no restart. Tested: a new charge of ৳70 is in `/api/delivery/areas` and in the next quote immediately; an order placed before keeps its ৳60.

### Tests
Categories (create, duplicate address, rename + turn off a category with products → it leaves `/api/categories` but its 3 products stay, slug cannot change, no DELETE, reorder, bad reorder), settings (all limits, unknown key, wrong type, hero must be published, all-or-nothing, the shop sees the change, hero "none", the lockout number is used by the login at once), delivery (new charge in the quote, old order keeps its charge, negative charge refused, free delivery over ৳1,500 on, a used zone cannot be turned off, a new zone + "Chattogram city" area + rename of the old one → the checkout asks city/outside, move "Outside Dhaka city" into the inside zone).

### Browser check (throwaway `drakon_ui`)
Delivery: Inside Dhaka ৳60 → ৳70, the shop API showed 7000 at once; split Chattogram. Settings: 500 hours was refused with "Use 1 to 168 hours. / Nothing was saved."; 36 hours + Night Striker as the hero were saved and the shop API showed both. Categories list with product counts. All three pages fit a 390-px phone. (I set the values back afterwards.)

### Key concepts (for a beginner)
- **All or nothing** (a transaction again): the settings are saved in one transaction, so a half-saved form can't happen.
- **Validation lives on the server**: the web shows the limits, but the Go code checks them again. A changed browser can't save 0 hours.

### How to test it yourself
See the morning checklist ("change the delivery charge and see it on checkout").

### Decisions and questions
- **Turning a category off** hides it from the menu and the collection tiles. Its products stay on sale (direct links and search still find them). To take products off sale, archive them. Tell me if "off" should also hide its products.
- A new area starts in the zone of the district's other area (you can change it in the form).
- Free delivery on/off is the setting `free_delivery_enabled` (also on the Delivery page); the amount is per zone ("free over").
- Open question 11 (hero product in Settings): built, as recommended.

---

## Phase 6: returns (blueprint rule 3)

### What I built
- **Migration `00006_returns.sql`**: `returns` (order, reason COMPANY_FAULT / OTHER, note, who paid the delivery, refund in paisa, refund method BKASH / NAGAD / CASH, reference, status, admin id, time) and `return_items` (which order line, how many, can it be sold again). Two database rules as a safety net: money refunded always says how, and "our mistake" always means the company pays the delivery.
- **`POST /api/admin/orders/{number}/returns`** (`api/internal/orders/returns.go`), in ONE transaction with the order row locked:
  - only a **DELIVERED** order (`409 NOT_DELIVERED`), and only within **`return_days`** after delivery (`409 RETURN_WINDOW_OVER`; the setting, 3 days now)
  - reason: **COMPANY_FAULT** (the company must pay the delivery) or **OTHER** (the condition must be checked: unused, tags on, seal not opened)
  - which pieces come back: never more than bought minus earlier returns (`409 TOO_MANY_PIECES`)
  - refund: all refunds together never more than the money collected (`409 REFUND_TOO_HIGH`); a refund needs a method, and bKash / Nagad need the transaction id
  - pieces that can be sold again go back to stock with `inventory_movements` **RETURN** (with your id and the order), and a SOLD_OUT product with stock again becomes ACTIVE (REACTIVATE event, blueprint rule 9)
  - when everything is refunded, the payment becomes **REFUNDED**
  - the order itself stays DELIVERED.
- The admin order now has `returnUntil`, `refundedPaisa`, and each line's `returnedQty`; the order answer lists the returns.
- **Web**: a **Returns** panel on delivered orders ("Open until 21 Oct, 2:20 am"), each return as a card, "Refunded so far: ৳350 of ৳410", and the **Record a return** form (reason with the policy explained, condition check, who pays delivery for "other", pieces per line with "Can be sold again", what happened, refund with "Pieces: ৳… · At most ৳…", bKash / Nagad / cash and the transaction id).

### Tests (all pass)
Only for delivered orders; one sellable piece back (stock +1, RETURN movement with admin id and order, payment still COLLECTED, the return shows with the admin email); too many pieces; refund too high; a broken piece (not back in stock) + the rest refunded in cash → payment REFUNDED, order still DELIVERED; every form rule; a line of another order; the window (4 days ago with 3 days → closed, with 7 days → open); a return of a sold-out drone makes it ACTIVE again.

### Browser check
On the delivered test order: recorded "Our mistake", 1 box not sellable, ৳350 back by bKash with an id. The card, "Refunded so far: ৳350 of ৳410" and "Every piece of this order has come back" showed; stock stayed 46; payment stayed Collected (partial refund).

### Key concepts (for a beginner)
- **Cumulative check**: "never more than paid" must count all earlier refunds too, not just this one. That is why the order row is locked: two returns typed at the same moment are checked one after the other.
- **CHECK constraint as a safety net**: even if the Go code had a bug, the database itself refuses "our mistake but the customer pays".

### How to test it yourself
Deliver a test order (checklist), open it: the Returns panel is at the bottom of the left column.

### Decisions and questions
- For "Our mistake" the pieces are **not** marked "can be sold again" by default (usually broken or wrong); for "Other reason" they are (unused, sealed). You can change the box per line.
- For "Other reason" you may still choose "We pay the delivery" (goodwill). For "Our mistake" the customer paying is refused (policy).
- A return does not change the order's status (still DELIVERED); the payment shows REFUNDED only when everything was refunded.
- No separate `/admin/returns` list page yet (the sitemap has one). Returns are on each order's page.
