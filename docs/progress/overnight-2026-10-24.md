# Overnight run 2026-10-24: full audit

Written for Abu Bakkar Siddik, in simple English. Tonight is **not for new features**: I check everything built so far, find problems and fix only the clear, safe bugs (each with a test and its own small commit). Nothing in this run was pushed to GitHub.

Security details of problems that are **not fixed yet** are not in this file (the repo is public). They are in the private report `~/Desktop/projects/Drakon/reports/audit-2026-10-24.md`.

## Plan

- [x] 0. Start: clean git, database up, all checks pass, tool list
- [x] 1. Security scan (manual review; the plugin could not run here)
- [x] 2. Business rules vs. the code
- [x] 3. API contract check
- [x] 4. Real browser check of every page
- [ ] 5. Database check
- [ ] 6. Code health
- [ ] 7. Docs check
- [ ] 8. Finish

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
