# Overnight run 2026-10-24: full audit

Written for Abu Bakkar Siddik, in simple English. Tonight is **not for new features**: I check everything built so far, find problems and fix only the clear, safe bugs (each with a test and its own small commit). Nothing in this run was pushed to GitHub.

Security details of problems that are **not fixed yet** are not in this file (the repo is public). They are in the private report `~/Desktop/projects/Drakon/reports/audit-2026-10-24.md`.

## Plan

- [x] 0. Start: clean git, database up, all checks pass, tool list
- [x] 1. Security scan (manual review; the plugin could not run here)
- [x] 2. Business rules vs. the code
- [x] 3. API contract check
- [x] 4. Real browser check of every page
- [x] 5. Database check
- [x] 6. Code health
- [x] 7. Docs check
- [x] 8. Finish (plus: safe open items fixed, project skills)

---

## Phase 0: start

### What I checked
- Read `CLAUDE.md`, `docs/blueprint.md` (business rules 1–10), `docs/open-questions.md` (questions 1–18), `docs/api.md`, `docs/deploy.md`, `.env.example` and the earlier logs in `docs/progress/`.
- `git status` on `main`: no changes to tracked files. One **untracked** folder: `web/src/components/_preview/ProductCardPreview.tsx` (dated 2026-10-21). It is not mine and not in any commit, so I left it exactly as it is. It does not break the build or the lint.
- `make db-up`: the database container is healthy.
- `make migrate-status`: 6 migrations applied (00001–00006).
- `make check`: gofmt, go vet and all Go tests pass.
- `npm run build` and `npm run lint`: both pass, no warnings.

### Tools I have tonight
| Tool | Kind | Where I use it |
|---|---|---|
| `claude-security` 0.12.0 | plugin (skill + agents) | Phase 1, full scan |
| `playwright` (Playwright MCP) | plugin / MCP server | Phase 4, real browser |
| `playwright-skill` 5.0.0 | plugin skill | backup for Phase 4 |
| `gopls-lsp`, `typescript-lsp` | plugins (LSP) | Phase 6: find references, unused code |
| Context7 | MCP server | library docs before any config change |
| graphify | skill + `~/Desktop/projects/Drakon/graphify-out/` (made 2026-10-21) | map of the code: which areas have many links and few tests. Not re-run. |
| claude-in-chrome | MCP server | not needed (Playwright is enough) |
| Go 1.27.3, Node 24.21.0, goose, sqlc, gopls | local | all checks |

### What I found
Nothing red. Everything starts clean.

### What I fixed
Nothing (nothing was broken).

### Key concepts (for a beginner)
- **Audit**: reading and testing code that already exists to find mistakes, instead of writing new features.
- **Untracked file**: a file git sees in the folder but that was never added to a commit. `git status` shows it with `??`. Git does not save it until you `git add` it.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon
git status                          # only web/src/components/_preview/ is untracked
cd api && make db-up && make migrate-status && make check
cd ../web && npm run build && npm run lint
```

---

## Phase 1: security scan

### What I checked
- **claude-security plugin**: it is installed (version 0.12.0), but its scan could not start. The scan runs as a "workflow", and this session does not have the Workflow tool. So no scan ran, and no `CLAUDE-SECURITY-*` folder was made (nothing to move, nothing left in the repo).
- So, as the plan says, I did a **careful manual security review** instead. I read the code for:
  - admin login on every `/api/admin` route (the route table and its test)
  - the Origin check on every admin change (login too)
  - cookie flags, session expiry (12 h idle, 7 days max), logout, password reset
  - the lockout after wrong passwords (also when many tries come at the same moment)
  - SQL: only through sqlc with parameters
  - logs: no personal data
  - photo addresses (type, folder, `..`, `javascript:` links)
  - security headers on the API and on the website (`web/public/_headers`)
  - CORS, error messages, body size, server timeouts
  - the Dockerfile and the Cloudflare Worker
- I checked a Cloudflare detail with **Context7** (how `_headers` patterns match).

### What I found
- **0 High, 1 Medium, 1 Low.** The Medium one is already an open question (4 and 14). Details: see the private report.
- Everything else in the list above is OK. Some good things the code already does:
  - The database stores only a **hash** of the session cookie.
  - Login gives the **same answer** for a wrong email and a wrong password.
  - The admin row is **locked** during a login try, so many tries at once are all counted.
  - Every SQL query uses **parameters**.

### What I fixed
Nothing in this phase. Both findings need a deploy or a decision from you.

### Key concepts (for a beginner)
- **SQL injection**: if code glues user text into an SQL string (`"... WHERE name = '" + name + "'"`), a visitor can type SQL and change the query. **Parameters** (`WHERE name = $1`) send the text separately, so it is always only data. sqlc always uses parameters.
- **Rate limit**: a rule like "at most 10 tries per minute from one IP address". It slows down people who guess passwords or order numbers.
- **Clickjacking**: a bad site shows your page inside an invisible frame and tricks you into clicking. The header `frame-ancestors 'none'` tells the browser "never show this page in a frame".

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make run                                    # terminal 1
# terminal 2:
curl -si -X POST localhost:8080/api/admin/logout | head -1                    # 403: no Origin
curl -si -X POST -H 'Origin: https://evil.example' localhost:8080/api/admin/logout | head -1   # 403
curl -si localhost:8080/api/admin/orders | head -1                            # 401: no cookie
curl -si localhost:8080/api/health | grep -i 'x-frame\|nosniff'              # security headers
```

---

## Phase 2: business rules vs. the code

### What I checked
Every business rule in `docs/blueprint.md` (rules 1–10) and the hard rules in `CLAUDE.md`, cut into small lines. For each line: where the code is, which test proves it.
Then the nasty cases: two requests at the same moment, the same order cancelled twice, stock exactly 1, limit exactly reached, midnight in Dhaka, very big and negative numbers, empty text, Bangla text, and the three phone formats.

Legend: ✅ OK (code + test) · ⚠️ no test (I wrote one) · ❌ wrong · ⏳ not built (open question or later) · 🔶 works as written, but there is a gap that needs your decision (finding)

### The rule table

| # | Rule line | Where (file → function) | Test | |
|---|---|---|---|---|
| 1a | Purchase limit per product (all variants together) | `orders/quote.go` → `buildQuote` | `TestQuoteProblems`, `TestPlaceOrderPurchaseLimitAcrossOrders` | ✅ |
| 1b | No limit set → default from `settings.default_purchase_limit` | `buildQuote` | `TestPlaceOrderPurchaseLimitAcrossOrders` (sleeves, 6 > 5) | ✅ |
| 1c | Guests counted by phone, across earlier orders (not cancelled) | `orders/place.go` → `Place` + `EarlierQtyByProduct` | `…AcrossOrders`, `TestPlaceOrderCancelledOrdersDoNotCountTowardsLimit` | ✅ |
| 1d | Limit exactly reached is allowed, one more is refused | `buildQuote` (`> limit`) | `…AcrossOrders` (1 + 1 = 2 OK, 1 + 2 refused) | ✅ |
| 1e | Same phone, two orders at the same moment | `LockPhone` (advisory lock) | `TestPlaceOrderLimitRaceSamePhone` | ✅ |
| 1f | Phone typed `+880 1712-345678` / `8801712345678` / `01712345678` = the same buyer | `orders/validate.go` → `NormalizePhone` | `TestNormalizePhone`, `…AcrossOrders`, `TestTrackByPhoneAndToken` | ✅ |
| 2a | Buyer cancels only in PENDING / CONFIRMED (number + phone or token) | `orders/track.go` → `Cancel` | `TestCancelOnlyWhilePendingOrConfirmed`, `TestCancelWithTokenAndWithWrongPhone` | ✅ |
| 2b | Stock back exactly once, also when cancelled twice | `CancelLocked` (row lock + status check) | `TestCancelPutsStockBack` ("cancelling twice"), `TestAdminAndBuyerCancelAtTheSameMoment` | ✅ |
| 2c | After SHIPPED only the admin can cancel | `orders/admin.go` → `nextMoves` | `TestAdminEveryMoveAllowedOrRefused` | ✅ |
| 3a | Return window from `return_days` after delivery | `orders/returns.go` → `RecordReturn` | `TestAdminReturnWindowAndValidation` | ✅ |
| 3b | Company's mistake → company pays the delivery; other reason → condition checked | `ReturnInput.clean` + DB CHECK | `TestAdminReturnWindowAndValidation` | ✅ |
| 3c | Refund never more than paid (all refunds together) | `RecordReturn` | `TestAdminReturnsStockRefundAndPayment`, **new** `TestAdminRefundCannotOverflow` | ❌ → ✅ fixed tonight |
| 3d | Refund recorded with method + bKash/Nagad reference | `ReturnInput.clean` | `TestAdminReturnWindowAndValidation` | ✅ |
| 3e | Two returns at the same moment | `GetOrderForReturn` (row lock) | `TestTwoReturnsAtTheSameMoment` | ✅ |
| 4a | COD sweep: PENDING older than `cod_confirm_hours` → CANCELLED by SYSTEM | `jobs/sweep.go` → `RunOnce` | `TestAutoCancelOldPendingOrders`, `TestAutoCancelUsesTheSetting` | ✅ |
| 4b | Sweep puts stock back, SOLD_OUT → ACTIVE | `CancelLocked` | `TestAutoCancelBringsSoldOutBack` | ✅ |
| 4c | Two sweeps at once cancel only once | row lock | `TestConcurrentSweepsCancelOnce` | ✅ |
| 4d | Admin cannot confirm an order that is already past the time | sweep before admin reads/changes | `TestAdminCannotConfirmAnExpiredOrder` | ✅ |
| 4e | Email to the buyer on auto-cancel | — | — | ⏳ (email not built) |
| 4f | Admin can block a phone; blocked phone cannot order | `blocked_phones`, `Place` | `TestAdminBlockAndUnblockPhone`, `TestPlaceOrderBlockedPhone` | ✅ |
| 5a | Delivery charge from the zone in the database | `GetDeliveryArea`, `applyDelivery` | `TestQuotePricesFromDatabase`, `TestQuoteOutsideDhakaAndFreeDelivery` | ✅ |
| 5b | Dhaka → "Dhaka city / Outside Dhaka city" choice; areas and zones admin-controlled | `delivery_areas`, admin delivery API | `TestDeliveryAreas`, `TestAdminDeliveryAreas`, `TestAdminDeliveryCharges` | ✅ |
| 5c | A turned-off area or zone cannot be ordered to | `GetDeliveryArea` (`is_active`) | `TestAdminDeliveryAreas` | ✅ |
| 6a | Free delivery over an amount, per zone, with the on/off setting (off at launch) | `applyDelivery` | `TestQuoteOutsideDhakaAndFreeDelivery`, `TestPlaceOrderAppliesFreeDelivery` | ✅ |
| 6b | Free delivery by coupon | — | — | ⏳ (later) |
| 7a | Phone required, email optional | `Checkout.Validate` | `TestPlaceOrderValidation` | ✅ |
| 7b | Order number + secret token; browser keeps only those two | `orders/tokens.go`, `web/src/features/orders/recentOrders.ts` | `TestTrackTokenHash`, `TestTrackByPhoneAndToken` | ✅ |
| 7c | Tracking answer has no personal data | `orders/view.go` | `TestTrackByPhoneAndToken` | ✅ |
| 7d | Status notifications (email / site / SMS) | — | — | ⏳ (email not built) |
| 8a | Only one Owner; role column | migration 00004 unique index | `TestOnlyOneOwnerAndPasswordReset` | ✅ |
| 8b | Strong password, lockout after wrong tries (numbers in settings) | `auth/auth.go` | `TestCheckNewPassword`, `TestAdminLockoutAndUnlock`, `TestAdminLockoutNumbersComeFromSettings` | ✅ |
| 8c | Admin URL never shown in the shop | (no link in `web/src` outside the admin) | checked by search | ✅ |
| 8d | Audit log of settings changes | — | — | ⏳ (open question 15) |
| 9a | DRAFT → ACTIVE only by Publish (photo + priced active variant, stock for a limited run) | `products/lifecycle.go` → `Publish` | `TestAdminPublishRules` | ✅ |
| 9b | Limited + stock 0 → SOLD_OUT (Showcase); normal → "Out of stock", can restock | `MarkSoldOutIfEmpty`, `ChangeStock` | `TestPlaceOrderSetsSoldOut`, `TestAdminStockRules` | ✅ |
| 9c | A limited run that sold out is never restocked | `ChangeStock` (`LIMITED_NO_RESTOCK`) | `TestAdminStockRules` | ✅ |
| 9d | Stock back after cancel/return → SOLD_OUT becomes ACTIVE again | `ReactivateIfStocked` | `TestCancelBringsSoldOutProductBack`, `TestAdminReturnBringsSoldOutBack` | ✅ |
| 9e | Auto-ARCHIVED after `archive_after_days`, or by hand | `ArchiveOldSoldOut`, `Archive` | `TestAutoArchive`, `TestAdminArchiveAndReactivate` | ✅ |
| 9f | ARCHIVED → ACTIVE only Owner, reason required, recorded | `Reactivate` + `product_events` | `TestAdminArchiveAndReactivate` | ✅ |
| 9g | One variant empty → only that one disabled; all empty → SOLD_OUT | `MarkSoldOutIfEmpty` (web shows the variant disabled) | `TestPlaceOrderSetsSoldOut` | 🔶 turning a variant *off* does not re-check (finding) |
| 9h | No product is ever deleted | no DELETE route for products/variants | `TestEveryAdminRouteNeedsASession` lists every route | ✅ (foreign keys: Phase 5) |
| 10a | Prices only BDT, integer paisa, with a currency column | migrations, `BIGINT …_paisa` | (schema) | ✅ (constraints: Phase 5) |
| 10b | Price can change in DRAFT, locked after ACTIVE | `UpdateVariant` (`PRICE_LOCKED`) | `TestAdminPriceLockAndPriceFix` | ✅ |
| 10c | Emergency price fix: Owner, reason, record | `PriceFix` + `product_events` | `TestAdminPriceLockAndPriceFix` | ✅ |
| 10d | A new variant on a live product with its own price | `AddVariant` | (probe) | 🔶 allowed without reason or record (finding) |
| 10e | Confirm prices before publish | `Publish` (`PRICES_CHANGED`) | `TestAdminPublishRules` | ✅ |
| 10f | Order keeps a snapshot: name, label, price, delivery charge | `InsertOrder`, `InsertOrderItem` | `TestPlaceOrderHappyPath`, `TestAdminPriceLockAndPriceFix` | ✅ |
| H1 | Server decides money; browser prices ignored | `orders` package; `DisallowUnknownFields` | `TestPlaceOrderIgnoresClientPrices` | ✅ |
| H6 | Stock decrement `… AND stock >= $1`, 0 rows → rollback | `DecrementStock` | `TestDecrementStockGuardWithTwoTransactions`, `TestPlaceOrderRaceForLastItem` (stock exactly 1) | ✅ |
| H7 | Order statuses and their only allowed moves | `nextMoves` | `TestAdminEveryMoveAllowedOrRefused` | ✅ |
| — | Two clicks on Confirm at the same moment | row lock | `TestAdminConfirmTwiceAtTheSameMoment` | ✅ |
| — | Admin stock change and checkout race for the last piece | lock order variant → product | `TestAdminStockChangeAndCheckoutRaceForTheLastPiece` | ✅ |
| — | "Today" on the dashboard starts at midnight in Dhaka | dashboard query | `TestAdminDashboardTodayIsDhakaTime` | ✅ |
| — | Bangla names / addresses: stored exactly, limits count letters not bytes, admin search finds them | `Checkout.Validate` (`utf8.RuneCountInString`) | **new** `TestPlaceOrderBanglaText` | ⚠️ → ✅ |

### What I found
- **1 bug (❌)**: the "refund never more than paid" check added two numbers. With an earlier refund and a giant new number, the sum "wraps around" (see Key concepts) and looked small, so the check let it through. The request then crashed later with a 500 (the database refused, so nothing wrong was saved). Fixed.
- **2 gaps (🔶)** that need your decision: turning a variant off on a live limited product, and adding a new variant with any price to a live product. Details in the private report.
- **1 missing test (⚠️)**: Bangla text. I wrote it; it passes (no bug).

### What I fixed
| Commit | What |
|---|---|
| `10fa0ea` | api: compare a refund with the amount left, not a sum that can wrap (test `TestAdminRefundCannotOverflow`) |
| `560f46e` | api: test Bangla names and addresses at checkout and in the admin search (test only) |

### Key concepts (for a beginner)
- **Integer overflow ("wrap around")**: an `int64` can hold numbers up to about 9.2 × 10¹⁸. If you add two big numbers and the answer is bigger, Go does not stop: the answer jumps to a huge **negative** number (like a car's odometer going from 999999 back to 000000). So `before + refund > paid` can be false even when the refund is gigantic. The safe way: `refund > paid - before`. A subtraction of two normal amounts can never overflow.
- **Runes vs bytes**: a Bangla letter like `ক` is 1 letter (a "rune" in Go) but 3 bytes in UTF-8. Limits for people ("at most 500 letters") must count runes (`utf8.RuneCountInString`), not bytes (`len`). DRAKON already does this right.
- **Row lock (`SELECT … FOR UPDATE`)**: while one transaction holds the lock on an order row, a second one that wants the same row waits. That is why "cancel twice at the same moment" puts the stock back only once.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
go test ./internal/httpapi -run 'TestAdminRefundCannotOverflow|TestPlaceOrderBanglaText' -count=1 -v
```
To see the old bug: open `api/internal/orders/returns.go`, find `in.RefundPaisa > pay.AmountPaisa-before`, change it back to `before+in.RefundPaisa > pay.AmountPaisa`, run the test (FAIL, 500), then put the fix back (PASS).

---

## Phase 3: API contract check

### What I checked
- **Every route in the Go router against `docs/api.md`**: 12 public routes + admin login + 39 admin routes (the table in `admin_routes.go`). Every route is in the docs, and every route in the docs exists. Field names in the examples match the Go `json:"…"` tags I read.
- **Every error code** the Go code can send against the docs' tables: all are listed.
- **Bad input on every route that takes a body** (a test that loops over all of them): broken JSON `{`, unknown field, a list `[]` instead of an object, empty body, `null`, a plain string, two objects, a number. Result: never a 500, always the one error shape `{"error":{"code","message"}}`.
- **Strange text**: very long text, Bangla, and the "NUL character" (`\u0000`, an invisible character with the number 0).
- **Public answers never show admin-only data**: tracking and checkout answers have no name, phone, address, admin note or other buyers' data; the shop never shows DRAFT products or turned-off variants. Track and cancel need the order number **and** the right phone or token.
- Wrong method on a known path (`POST /api/health`) answers 404: that is open question 10 (your choice), not a bug.

### What I found
1. A **NUL character** in any text made the API answer **500** ("Something went wrong on our side"). PostgreSQL cannot store this character at all, so it refused, and our code treated that like our own bug. It happened on public pages too (order form, shop search, product address). → fixed: now `400 BAD_TEXT` with a clear message.
2. A body that is not an object (`[]`, `123`) gave the odd message `The field "" has the wrong type.` → fixed: "The request body must be a JSON object (between { and })."
3. Docs vs code: no differences (I added the new `BAD_TEXT` code to `docs/api.md`).

### What I fixed
| Commit | What |
|---|---|
| `9fad8d8` | api: clear message when the request body is not a JSON object (test `TestDecodeJSONNotAnObject`) |
| `452ae70` | api: answer 400 BAD_TEXT, not 500, for text the database cannot store (test `TestNulCharacterIsABadRequest`, docs/api.md) |
| `917984a` + `950f927` | api: test odd bodies on every route that reads one (`TestEveryBodyRouteRefusesBadBodies`). Honest note: `917984a` was committed with this test failing (my command hid the red result behind a pipe); `950f927` fixed the test a minute later (DELETE routes read no body). From then on I ran the checks with `set -o pipefail`. |

### Key concepts (for a beginner)
- **400 vs 500**: 4xx means "the request was wrong" (the visitor can fix it). 5xx means "the server broke" (we must fix it). Giving a 500 for bad input is wrong twice: the visitor gets no help, and our log fills with false alarms.
- **SQLSTATE**: every PostgreSQL error has a 5-character code. `22021` means "this text has a character the database cannot store". In Go, `errors.As(err, &pgErr)` lets us read that code from the error.
- **One place for a rule**: instead of checking for NUL in 40 handlers, the fix sits in `wrap` (the function every handler goes through). One change, every route is covered.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
go test ./internal/httpapi -run 'TestNulCharacterIsABadRequest|TestDecodeJSONNotAnObject' -count=1 -v
make run        # terminal 1, then in terminal 2:
curl -s 'localhost:8080/api/products?q=%00'                     # {"error":{"code":"BAD_TEXT",…}}
curl -s -X POST localhost:8080/api/orders/track -H 'Content-Type: application/json' -d '[]'
# {"error":{"code":"BAD_JSON","message":"The request body must be a JSON object (between { and })."}}
```

---

## Phase 4: real browser check of every page

### What I checked
- Setup: a throwaway database **`drakon_ui`** (all migrations + the sample data) with a throwaway owner `ui-test@drakon.test`, the API pointed at it, and the Vite dev server. I checked that the API wrote only to `drakon_ui` (your `drakon` database was not touched). At the end I stopped both servers and **dropped `drakon_ui`**.
- Tool: the **Playwright MCP** (a real Chromium browser), at **390×844** (phone) and **1440×900** (desktop).
- On **every page** (20 shop pages, 11 admin pages, both sizes) one script checked: sideways scrolling, broken images, images without alt text, inputs without a label, text sticking out of the screen, links and buttons smaller than 44 px, console errors and failed network requests. A second script pressed Tab through pages and checked that every focused element shows a visible ring.
- **Customer journey** (by hand, in the browser): Home → Shop → Clothes → hoodie (sold-out size L is disabled and read out as "sold out") → quantity stops at the limit (2) → adding another size says "Limit reached in your cart" → Cart → Checkout: empty form (clear messages, focus jumps to the first mistake) → Dhaka → "Dhaka city ৳60 / Outside Dhaka city ৳100" → Khulna ৳100 → order with a **Bangla name and area** and the phone typed `+880 1712-345678` → Confirmation (order number, Copy button says "Copied") → Track with a lower-case number and the phone typed `8801712345678` → Cancel with a **double click** → the stock came back exactly once.
- **API down**: I stopped the API. Every page shows "The shop is not answering right now. Please try again in a moment." with a Try again button. No crash. After restarting the API, Try again worked.
- **Admin journey**: wrong password (clear message with the lockout numbers) → login → Dashboard → Orders (search by name, search by phone typed `018-1234`, status tabs) → order: confirm → ship (button waits for courier + tracking code) → delivered and paid → return (a too-high refund is blocked on the page; ৳1,800 by bKash saved with the admin email) → cancel another order with a reason (stock back to 48) → Products: new DRAFT → bad photo address refused → photo → variant at `1,600.50` Taka → stock +10 → Publish (price confirm step) → Owner price fix (needs an "I checked" tick; old → new price and reason in the record) → stock to 0 (Sold out) → Archive → Bring back (reason of at least 10 letters) → Delivery: Dhaka city ৳60 → ৳70, and the shop showed ৳70 at once → Settings: 36 hours saved, 999 refused ("Use 1 to 168 hours") → Categories → Blocked phones (an order from the blocked phone, typed differently, was refused with 403) → unblock → Log out (admin pages go back to the login page).
- Screenshots (65) are only in `~/Desktop/projects/Drakon/reports/screens-2026-10-24/` (not in the repo).

### What I found
- **No** sideways scrolling, broken images, missing alt texts, inputs without labels or overflowing text on any page, at either size. Focus is visible everywhere I tabbed. The only console errors were expected ones (a 404 for a made-up product, 401 before logging in, 502 while I had stopped the API).
- **1 bug, fixed**: the football's size showed as **"Size Size 5"** (cart, order, admin). Cause: the sample data had the label `Size 5`, and the site always writes "Size " before a size label. I fixed the sample data (label `5`) and added a test that no sample label repeats its kind.
- **Low findings (not fixed, need a design choice or are cosmetic)**: many shop links are smaller than 44 px (footer links 18 px tall, category chips 36 px, breadcrumbs 16 px); a few admin targets too; "Collect in cash" still shows after the cash was collected; the publish record shows the price in paisa (`160050`); the "Published" notice stays on screen; nothing stops you typing a label like "Size M" for a size. Details in the private report.

### What I fixed
| Commit | What |
|---|---|
| `e4a8bbb` | seed: football variant label 5, not Size 5 (test `TestSeedVariantLabelsDoNotRepeatTheKind`) |

**Your own dev database still has the old label** (the seed never overwrites). Fix it in 20 seconds: Admin → Products → Night Striker Football → the variant → Edit → Option name `5` → Save. Old orders keep "Size Size 5" on purpose: an order is a snapshot and never changes.

### Key concepts (for a beginner)
- **Snapshot**: when an order is placed, the product name, option name and price are *copied* into `order_items`. Later changes to the product never change old orders. That is why the old test order still shows "Size Size 5": it is a true copy of what the buyer saw.
- **Tap target**: the area you can touch to press a link or button. Apple and Google suggest at least 44–48 px, so a thumb hits it without zooming.
- **Seed data**: sample rows (`api/db/seed/dev_seed.sql`) so your PC has products to look at. It is not the real shop data; the live site starts empty.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api && make run        # terminal 1
cd ~/Desktop/projects/Drakon/drakon/web && npm run dev     # terminal 2
```
Then on your phone-sized browser window (Chrome: F12 → the phone icon → 390 × 844):
1. Open http://localhost:5173/product/ember-night-hoodie-edition-02, press + until it stops (2), add to cart, pick size M: the button says "Limit reached in your cart".
2. Stop the API (Ctrl+C in terminal 1) and reload: the friendly message, no white screen. Start it again and press Try again.
3. Admin → Delivery → change Inside Dhaka to 70 → open a product page: "Delivery ৳70 inside Dhaka". Change it back to 60.

---

## Phase 5: database check

### What I checked
1. **Constraints**, read from the real schema (not from memory):
   - every money column is `BIGINT` (`*_paisa`) with a CHECK: prices and order lines `> 0`, delivery charge, payments, refunds `>= 0`, free-over `> 0`
   - `stock >= 0`, every `qty > 0`, stock movements `change <> 0`
   - `orders.total_paisa = subtotal_paisa + delivery_paisa` and `order_items.line_total_paisa = unit_price_paisa * qty`: the database itself refuses wrong sums
   - phone format, order number format, a cancelled order must have a time and a reason, an ADMIN history row must name the admin
2. **Foreign keys**: all 25 use the default `NO ACTION`. Nothing uses `ON DELETE CASCADE`. So the database itself refuses to delete a product or an order that anything points to.
3. **Every `DELETE` in the queries**: only admin sessions, an unblocked phone, product detail rows (rewritten on save) and a single photo. Never an order, product or variant.
4. **Indexes + `EXPLAIN ANALYZE`**: on a throwaway database with the sample data **plus 50,000 generated orders** (with tiny tables PostgreSQL always reads the whole table, so the result would mean nothing). 13 main queries: shop list, order by number, admin order list (no filter, by status, search), search count, sweep, dashboard (3), purchase limit by phone, call list, and the "generic plan" pgx may use after 5 calls.
5. **Migrations**: on the same throwaway database: `goose up` → `goose down-to 0` → `goose up`. After `down-to 0` only goose's own table was left (no tables, no enum types).
6. **`make sqlc`**: no diff (the generated Go code matches the SQL files).

### What I found
| Query | 50,000 orders | Plan |
|---|---|---|
| order by number (track, admin) | 0.03 ms | unique index |
| admin list, newest 50 (any status) | 0.1–0.2 ms | index on `created_at` |
| purchase limit (earlier orders of a phone) | 0.04 ms | index on `phone` |
| sweep (PENDING older than 48 h) | 4 ms | index on `(status, created_at)` |
| dashboard "placed today" | 0.2 ms | index on `created_at` |
| dashboard counts per status | 10 ms | reads all orders (fine) |
| admin **search** count (`%text%`) | 33 ms | reads all orders |

- No query is slow. The search reads every order because `ILIKE '%text%'` (text anywhere in the name) cannot use a normal index. 33 ms at 50,000 orders is fine; only at hundreds of thousands it would need a special "trigram" index. **So: no new index, no new migration.**
- Every Down migration works. `make sqlc` gives no diff.
- 2 Low findings (a missing `currency = 'BDT'` check, the search note above). Details in the private report.

### What I fixed
Nothing (nothing was broken). Both throwaway databases are dropped.

### Key concepts (for a beginner)
- **CHECK constraint**: a rule inside the database, like `CHECK (stock >= 0)`. Even if the Go code had a bug, the database would refuse the bad row. It is the last safety net.
- **Foreign key**: `order_items.order_id REFERENCES orders(id)` means "every line must belong to a real order". With the default rule (NO ACTION), deleting an order that has lines is refused. `ON DELETE CASCADE` would delete the lines too; DRAKON never uses it, on purpose.
- **Index**: like the index at the back of a book. Without it the database reads every row (a "Seq Scan"). With it, it jumps to the right rows ("Index Scan"). A search for text *in the middle* of a word (`%abc%`) cannot use a normal index, like a book index cannot find words by their middle letters.
- **`EXPLAIN ANALYZE`**: shows the plan PostgreSQL chose and how long it really took.
- **Up / Down migration**: Up builds the change, Down undoes it. Running up → down → up proves you can always go back one step safely.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
docker compose exec db psql -U drakon -d drakon -c "EXPLAIN ANALYZE SELECT * FROM orders WHERE order_number = 'DRK-AAAAAA'"
# look for "Index Scan using orders_order_number_key"
export PATH="$PATH:$(go env GOPATH)/bin"
make sqlc && git status          # nothing changed = generated code is up to date
```
(The up/down test needs a throwaway database; do not run `goose down` on your `drakon` database, it deletes the tables and your test data.)

---

## Phase 6: code health

### What I checked
| Check | Result |
|---|---|
| `go vet ./...` | clean |
| `staticcheck` (run with `go run …@latest`, nothing added to the project) | only one style rule (ST1005: "error text should start with a small letter") on the photo messages in `images.go`. Those messages are full sentences shown to you in the admin, so they are right as they are. No unused Go code. |
| `govulncheck` | **0** problems your code can reach. It lists one in `golang.org/x/crypto/openpgp`, a package DRAKON never imports (we use only `bcrypt` from that module). |
| `go test -race -count=1 ./...` | all pass, no data races |
| `errcheck` (ignored Go errors) | only harmless ones (closing a file we only read, `json.Marshal` of a plain number) |
| `npm audit` (read only) | 0 vulnerabilities |
| TypeScript strict | **on**. There is no `"strict": true` line, because TypeScript 6 turns it on by default. I proved it with a small test file: both an untyped parameter and `null` in a `string` were refused. |
| Unused exports (script + the **typescript LSP** "find references") | 2 found: `PackageIcon` and `lineCount`. The LSP showed no use anywhere, so I removed them. |
| Duplicated logic | none harmful: one money formatter (`lib/money.ts`), one Taka parser for admin inputs (text-based, no float maths), one phone rule (same as Go), one `fetch` wrapper (`lib/api.ts`) |
| Hard-coded business numbers | none. Delivery charges, the 48 hours, return days, limits and the low-stock number all come from the API. What remains are safety limits (text lengths, max price, page sizes). |
| Error handling in React | every button action catches errors and shows a message; every page load has loading and error states (the "API down" test in Phase 4 proved it) |
| Double order | a triple click on "Place order" sent exactly **one** order (tested in the browser on a throwaway database, then dropped it) |
| graphify map | the most connected web functions, `formatTaka` (48 links) and `useApi` (41), have no unit tests: the web has no test runner yet (finding) |

### What I found
- No bugs. 4 Low findings: no web unit tests; the Cloudflare Worker file is not type-checked by `npm run build` (it is clean when checked by hand); `Checkout.tsx` (793 lines) and `AdminOrder.tsx` (636 lines) are big; search shows at most 48 results. Details in the private report.
- I did **not** split the two big files: the rule was "only a pure move with the browser check passing", and a careful split plus a full re-check is better done in daylight with you.

### What I fixed
| Commit | What |
|---|---|
| `712325a` | web: remove two exports nothing uses (`PackageIcon`, `lineCount`) |

### Key concepts (for a beginner)
- **Race detector** (`go test -race`): Go watches every memory read and write while the tests run and complains if two goroutines touch the same variable without a lock. Slower, but it finds bugs that happen only "sometimes".
- **Vulnerability scan** (`govulncheck`): compares your modules with a public list of known security bugs, and checks whether your code actually *calls* the broken function. "In a module you require, but not called" = no danger.
- **Dead code**: code nobody calls. It still has to be read and kept working, so it is removed, but only after a tool (the LSP) proves nothing uses it.
- **Strict TypeScript**: makes TypeScript refuse values that might be missing (`null`) or have no type (`any`), so many bugs show up as red errors before the code ever runs.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
go vet ./... && go test -race -count=1 ./...          # takes about 5 minutes with -race
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
cd ../web && npm audit && npm run build && npm run lint
```

---

## Phase 7: docs check

### What I checked
- **`.env.example`** against every `os.Getenv` in the Go code: `DATABASE_URL`, `PORT`, `COOKIE_SECURE`, `ALLOWED_ORIGINS`, `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` are there. `TEST_DATABASE_URL` (an optional setting for the tests) was missing.
- **`README.md`**: commands, Go 1.27 (go.mod says 1.27.1), the checks table, the admin account commands: all correct.
- **`CLAUDE.md`** Commands and library notes: React Router 7.18 (still v7, as decided), Vite 8, Tailwind 4, sqlc `version: "2"` with `pgx/v5` and `db/migrations`, the admin route rule and its test name: all correct.
- **`docs/api.md`**: every route (Phase 3), the public settings keys and every admin setting limit (compared with `settings/rules.go`), the search fields (shop: name + kind; admin products: name + SKU), the session times, the error codes (I added `BAD_TEXT` in Phase 3).
- **`docs/deploy.md`**: Dockerfile Go version (1.27), health path, the 64 districts / 65 delivery areas, the env variables table: all correct.

### What I found
- One small gap: `TEST_DATABASE_URL` was not in `.env.example`. Fixed (as a commented, optional line).
- Six new decisions for you, from tonight's findings, are now **open questions 19–24** in `docs/open-questions.md` (each with my recommendation).

### What I fixed
| Commit | What |
|---|---|
| `a81b916` | docs: mention the optional TEST_DATABASE_URL in .env.example |
| `39c5214` | docs: open questions 19–24 from the audit |

### Key concepts (for a beginner)
- **Docs drift**: code changes but the docs do not, and after a few weeks the README tells you to run a command that no longer exists. Checking docs against the code (not against memory) after big changes keeps them true.
- **`.env.example`**: the public list of every setting the program reads, with safe example values. The real `.env` (with passwords) stays only on your PC.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon
grep -rhoE 'Getenv\("[A-Z_]+"\)' api --include='*.go' | sort -u     # every setting the Go code reads
grep -oE '^#? ?[A-Z_]+=' .env.example                               # every setting in the example file
```

---

## After the phases: safe open items, then project skills

The plan said: with time left, go back to open findings that turned out to be safe, then write project skills. I fixed four (each its own commit, build and lint green):

| Commit | What | How I proved it |
|---|---|---|
| `0222e41` | web: type-check the Cloudflare Worker in `npm run build` (new `web/tsconfig.worker.json`, added to the references) | I put a deliberate type error into `worker/index.ts`: before, `npm run build` passed; after, it failed with `TS2322`. Then I removed the error. (Checked TypeScript project references with Context7 first.) |
| `6f4b3eb` | web: the admin order total says "Collected in cash" after delivery and "Order total" after a cancel (it always said "Collect in cash") | browser, before/after screenshots in the private reports folder |
| `f8c0d27` | web: `noindex` and `no-store` also for the bare `/admin` page (the rule `/admin/*` does not match `/admin` itself; Cloudflare docs via Context7) | only testable after deploy: `curl -sI https://<your-site>/admin` should show `X-Robots-Tag` |
| `9c58cd3` | web: the "Published. It is live" notice disappears after the next change (it stayed even after the product became Sold out) | browser: shown after Publish, gone after a stock change |

I left the "Published at AUD-STD 160050" record text as it is: making it show ৳ would need a money helper shared between two Go packages, too much change for a cosmetic text.

**Project skills** (`.claude/skills/`, commit `cefc0f0`), written after checking the current Claude Code docs on skills with Context7:
- `drakon-new-migration`: how to add a goose migration, prove the Down step on a throwaway database, regenerate sqlc
- `drakon-admin-route`: the checklist for a new `/api/admin` route (route table + its test, Origin, errors, transactions, docs)
- `drakon-money-and-stock`: paisa, server-side prices, the safe stock decrement, cancels, returns, SOLD_OUT and limits, and the nasty cases to test

Claude Code reads them by itself when a task matches their description.

---

## Phase 8: finish

### Final checks
- `make check` (gofmt, vet, all tests, also once with `-count=1` so nothing came from the cache): **green**
- `npm run build` and `npm run lint`: **green**
- `git status`: on `main`, nothing changed except your own untracked `web/src/components/_preview/` (I never touched it). No reports, screenshots or `CLAUDE-SECURITY-*` folders in the repo. The Playwright tool's working folder was moved out of the repo after each browser session.
- Throwaway databases `drakon_ui` and `drakon_audit`: dropped. Your `drakon` database: never touched.
- **Nothing was pushed.**

### Every commit of tonight (24, oldest first)
| Commit | What |
|---|---|
| `fecf330` | docs: start the audit log (phase 0) |
| `341d478` | docs: audit log phase 1 (security review) |
| `10fa0ea` | api: compare a refund with the amount left, not a sum that can wrap |
| `560f46e` | api: test Bangla names and addresses at checkout and in the admin search |
| `422eb5a` | docs: audit log phase 2 (business rule table) |
| `9fad8d8` | api: clear message when the request body is not a JSON object |
| `452ae70` | api: answer 400 BAD_TEXT, not 500, for text the database cannot store |
| `4fabb1d` | docs: audit log phase 3 (API contract) |
| `917984a` | api: test odd bodies on every route that reads one (committed red by mistake, see Phase 3) |
| `950f927` | api: leave DELETE out of the odd-body test (makes it green) |
| `e4a8bbb` | seed: football variant label 5, not Size 5 |
| `21caf54` | docs: audit log phase 4 (browser check) |
| `2d5176e` | docs: audit log phase 5 (database) |
| `712325a` | web: remove two exports nothing uses |
| `f6c7686` | docs: audit log phase 6 (code health) |
| `a81b916` | docs: mention the optional TEST_DATABASE_URL in .env.example |
| `39c5214` | docs: open questions 19–24 from the audit |
| `d23e38b` | docs: audit log phase 7 (docs check) |
| `0222e41` | web: type-check the Cloudflare worker in npm run build |
| `6f4b3eb` | web: admin order total says Collected / Order total |
| `f8c0d27` | web: noindex and no-store also for the bare /admin page |
| `9c58cd3` | web: clear the Published notice after the next product change |
| `cefc0f0` | docs: project skills for migrations, admin routes, money and stock |
| (this one) | docs: finish the audit log (phase 8) |

## Summary

| Severity | Found | FIXED | OPEN |
|---|---|---|---|
| High | 0 | 0 | 0 |
| Medium | 4 | 2 | 2 |
| Low | 17 | 6 | 11 |
| **All** | **21** | **8** | **13** |

**FIXED (short):** refund limit check could wrap around · NUL character gave a 500 · odd message for a non-object body · "Size Size 5" in the sample data · Worker not type-checked by the build · "Collect in cash" after delivery · `/admin` page header rule · stale "Published" notice.

**New tests:** `TestAdminRefundCannotOverflow`, `TestPlaceOrderBanglaText`, `TestDecodeJSONNotAnObject`, `TestNulCharacterIsABadRequest`, `TestEveryBodyRouteRefusesBadBodies`, `TestSeedVariantLabelsDoNotRepeatTheKind`.

**OPEN items: see the private report** `~/Desktop/projects/Drakon/reports/audit-2026-10-24.md` (13 items, each with a suggested fix and effort).

## Decisions for the morning
1. **Rate limiting** (open questions 4 and 14) is still the biggest missing piece before launch.
2. **Open questions 19–24** (new tonight), each with my recommendation:
   - 19: a new variant on a live product, with any price and no record
   - 20: turning a variant off should re-check "sold out"
   - 21: refuse option names like "Size M" for a Size
   - 22: bigger shop links (44 px)
   - 23: a few web unit tests with Node's own test runner (no new package)
   - 24: "48 of N" on the search page
3. Splitting `Checkout.tsx` (793 lines) and `AdminOrder.tsx` (636 lines): a good daylight job together, with a full browser re-check.

## Morning checklist
- [ ] Read the private report: `~/Desktop/projects/Drakon/reports/audit-2026-10-24.md` (start with the 2 open Medium items).
- [ ] Look at a few screenshots in `~/Desktop/projects/Drakon/reports/screens-2026-10-24/` (`390-…` = phone, `1440-…` = desktop).
- [ ] Run the checks yourself:
  ```zsh
  cd ~/Desktop/projects/Drakon/drakon/api && make check
  cd ../web && npm run build && npm run lint
  ```
- [ ] Fix the old label in your dev database: Admin → Products → Night Striker Football → variant → Edit → Option name `5`.
- [ ] Answer open questions 19–24 (and 4 / 14).
- [ ] Look at `git log --oneline -25`, then push when you are happy: `git push`.
- [ ] Decide what to do with your untracked `web/src/components/_preview/` folder.

## Morning practice
Small exercises, typed by you, based on tonight's fixes. Each takes 5–15 minutes.

1. **See an integer overflow.** Make a scratch folder outside the repo and run a tiny Go program:
   ```zsh
   mkdir -p ~/scratch/overflow && cd ~/scratch/overflow
   cat > main.go <<'GO'
   package main

   import (
   	"fmt"
   	"math"
   )

   func main() {
   	before, paid := int64(1000), int64(366000)
   	refund := int64(math.MaxInt64 - 500)
   	fmt.Println("before+refund =", before+refund)                 // a negative number!
   	fmt.Println("old check says too high:", before+refund > paid) // false: the bug
   	fmt.Println("new check says too high:", refund > paid-before) // true: correct
   }
   GO
   go run main.go
   ```
   Then explain in one sentence why `paid - before` can never overflow here.
2. **Read a test.** Open `api/internal/httpapi/admin_returns_test.go`, find `TestAdminRefundCannotOverflow`, and run only it: `cd ~/Desktop/projects/Drakon/drakon/api && go test ./internal/httpapi -run TestAdminRefundCannotOverflow -v -count=1`.
3. **Add one case to a table test.** In `api/internal/httpapi/json_test.go`, `TestDecodeJSONNotAnObject` loops over `[]`, `"x"`, `123`, `true`. Add `false` and `null`. Run the test. One of them fails: which one, and why? (Hint: what does Go do when it decodes `null` into a struct?) Remove the failing one again, or keep it and explain it in a comment.
4. **Watch the Worker type-check work.** Add `export const x: number = 'oops'` at the end of `web/worker/index.ts`, run `npm run build` in `web/` (red), then delete the line (green). This is exactly what `tsconfig.worker.json` added tonight.
5. **Read the sweep and draw it.** Open `api/internal/jobs/sweep.go` and draw on paper the three things `RunOnce` does, in order, and which table each one changes.

OVERNIGHT STATUS: ALL PHASES DONE
