# DRAKON API

The Go server in `api/`. Every path starts with `/api` and every answer is JSON.
Run it with `cd api && make run` (http://localhost:8080). Through the website in dev, the same paths work on http://localhost:5173 (Vite forwards them).

Money is always **integer paisa** (৳1,250 = `125000`). Prices are never accepted from the browser.

## Errors

Every error has the same shape:

```json
{"error": {"code": "UPPER_SNAKE", "message": "A sentence you can show to the buyer."}}
```

Some errors add more:
- `fields`: one message per form field (`422` answers), e.g. `{"phone": "Enter an 11-digit mobile number…"}`
- `problems`: the cart items that stop an order (`409` answers), e.g. `[{"variantId": 10, "code": "NOT_ENOUGH_STOCK", "message": "Only 3 left."}]`

| Status | Codes |
|---|---|
| 400 | `BAD_JSON`, `UNKNOWN_FIELD`, `BAD_QUERY`, `EMPTY_CART`, `BAD_CART`, `CART_TOO_LARGE`, `BAD_TEXT` (a NUL character `\u0000` in any text: the database cannot store it) |
| 401 | `UNAUTHORIZED`, `INVALID_LOGIN` (admin) |
| 403 | `PHONE_BLOCKED`, `BAD_ORIGIN` (admin) |
| 404 | `NOT_FOUND`, `ORDER_NOT_FOUND` |
| 409 | `OUT_OF_STOCK`, `PURCHASE_LIMIT`, `UNAVAILABLE`, `CANNOT_CANCEL` |
| 413 | `BODY_TOO_LARGE` (bodies are limited to 1 MB) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` (send `Content-Type: application/json`) |
| 422 | `VALIDATION`, `UNKNOWN_AREA`, `BAD_LOOKUP` |
| 429 | `TOO_MANY_TRIES` (per-IP rate limit, see below), with a `Retry-After: <seconds>` header |
| 500 | `INTERNAL` (details only in the server log, never in the answer) |
| 503 | `DATABASE_DOWN` |

Unknown JSON fields are refused (`UNKNOWN_FIELD`). That is how a `pricePaisa` sent by a browser is stopped.

### Rate limits (per IP address)

`POST /api/admin/login`, `POST /api/orders`, `POST /api/orders/track` and `POST /api/orders/cancel` count tries per IP address in a fixed window. The numbers are settings (Admin > Settings > "Too many tries"): `rate_<login|order|track|cancel>_tries` per `rate_<…>_minutes`. Defaults: login 4 per 15 min, orders 30 per 10 min, track 30 per 10 min, cancel 10 per 10 min. Over the limit:

```zsh
# HTTP/1.1 429 Too Many Requests
# Retry-After: 540
# {"error":{"code":"TOO_MANY_TRIES","message":"Too many tries. Please wait 9 minutes and try again."}}
```

A refused try never reaches the handler (a refused login does not count towards the account lockout). The IP is the direct connection address; `X-Forwarded-For` and friends are ignored unless `TRUSTED_PROXY=cloudflare` and the request carries the Worker's `PROXY_SECRET` (`docs/deploy.md`).

---

## Health

### `GET /api/health`
```zsh
curl -s localhost:8080/api/health
# {"database":"ok","status":"ok"}
```

## Catalog

### `GET /api/categories`
```zsh
curl -s localhost:8080/api/categories
# {"categories":[{"slug":"playcards","name":"Playcards","image":"/img/cat-playcard.webp"}, ...]}
```

### `GET /api/products?category=&q=&limit=&offset=`
Products on sale (ACTIVE only). `category` = category slug. `q` searches the name and kind (any case, max 100 characters). `limit` 1–100 (default 24), `offset` 0–10000.
```zsh
curl -s 'localhost:8080/api/products?category=clothes'
curl -s 'localhost:8080/api/products?q=hoodie&limit=10&offset=0'
# {"products":[ Product, ... ], "total":1, "limit":10, "offset":0}
```

A **Product** looks like this:
```json
{
  "id": 2, "slug": "ember-night-hoodie-edition-02", "name": "Ember Night Hoodie · Edition 02",
  "categorySlug": "clothes", "kind": "Clothes", "variantKind": "Size",
  "isLimited": true, "editionSize": null, "status": "ACTIVE", "purchaseLimit": 2,
  "summary": "...", "story": ["paragraph", "paragraph"],
  "details": [{"term": "Material", "text": "..."}],
  "images": [{"src": "/img/p-hoodie02-front.webp", "thumb": "/img/t-p-hoodie02-front.webp", "name": "Front", "alt": "..."}],
  "variants": [{"id": 6, "sku": "HD02-S", "label": "S", "note": "", "pricePaisa": 245000, "currency": "BDT", "stock": 3, "imageIndex": null}],
  "soldOutAt": null, "successorSlug": null
}
```
`purchaseLimit: null` means "use `defaultPurchaseLimit` from the settings".

### `GET /api/products/featured`
"The current drop" (in `featured_order`) and the product under the home page hero (`hero`, from the setting `home_hero_product_slug`).
```zsh
curl -s localhost:8080/api/products/featured
# {"products":[ ... ], "hero": Product or null}
```

### `GET /api/products/{slug}`
Everything the product page shows, plus up to 4 `related` products on sale. A DRAFT product answers `404` like an unknown slug.
```zsh
curl -s localhost:8080/api/products/dragon-flame-card-edition-01
# {"product": Product, "related": [ Product, ... ]}
curl -s localhost:8080/api/products/nope
# {"error":{"code":"NOT_FOUND","message":"There is no product with this address."}}
```

### `GET /api/sold-out`
SOLD_OUT and ARCHIVED runs, the most recent first.
```zsh
curl -s localhost:8080/api/sold-out
# {"products":[ ... ]}
```

## Delivery and settings

### `GET /api/delivery/areas`
```zsh
curl -s localhost:8080/api/delivery/areas
```
```json
{
  "zones": [
    {"code": "INSIDE_DHAKA", "name": "Inside Dhaka", "chargePaisa": 6000, "freeOverPaisa": null, "currency": "BDT"},
    {"code": "OUTSIDE_DHAKA", "name": "Outside Dhaka", "chargePaisa": 10000, "freeOverPaisa": null, "currency": "BDT"}
  ],
  "districts": [
    {"name": "Bagerhat", "areas": [{"id": 65, "label": "Bagerhat", "hint": "", "zoneCode": "OUTSIDE_DHAKA"}]},
    {"name": "Dhaka", "areas": [
      {"id": 1, "label": "Dhaka city", "hint": "Inside Dhaka zone", "zoneCode": "INSIDE_DHAKA"},
      {"id": 52, "label": "Outside Dhaka city", "hint": "Savar, Keraniganj and others", "zoneCode": "OUTSIDE_DHAKA"}
    ]}
  ],
  "freeDeliveryEnabled": false
}
```
A district with more than one area asks the buyer to choose. The `id` of the chosen area is the `deliveryAreaId` for the quote and the order. Ids are just numbers given by the database (on your PC Dhaka city happens to be `1`); always read them from this endpoint.

### `GET /api/settings/public`
Only the numbers the website shows.
```zsh
curl -s localhost:8080/api/settings/public
# {"codConfirmHours":48,"courierNoteMaxChars":200,"currency":"BDT","defaultPurchaseLimit":5,
#  "giftNoteMaxChars":150,"lowStockThreshold":5,"returnDays":3}
```

## Checkout and orders (Cash on Delivery only)

### `POST /api/checkout/quote`
Prices a cart from the database. `deliveryAreaId` is optional (no area = no delivery and no total yet). Repeated variants are added together.
```zsh
curl -s -X POST localhost:8080/api/checkout/quote -H 'Content-Type: application/json' \
  -d '{"items":[{"variantId":1,"qty":2},{"variantId":10,"qty":1}],"deliveryAreaId":1}'
```
```json
{
  "items": [{"variantId": 1, "productId": 1, "productSlug": "dragon-flame-card-edition-01",
             "productName": "Dragon Flame Card · Edition 01", "variantName": "Hard paper",
             "thumb": "/img/t-c-df-paper.webp", "unitPricePaisa": 45000, "qty": 2,
             "lineTotalPaisa": 90000, "stock": 22, "maxQty": 2, "problem": null, "currency": "BDT"}],
  "problems": [],
  "subtotalPaisa": 430000,
  "delivery": {"areaId": 1, "district": "Dhaka", "areaLabel": "Dhaka city", "zoneCode": "INSIDE_DHAKA",
               "chargePaisa": 6000, "freeDelivery": false},
  "totalPaisa": 436000,
  "currency": "BDT"
}
```
Problem codes per item: `UNKNOWN_VARIANT` (not for sale; the website drops it quietly), `UNAVAILABLE` (sold out run), `OUT_OF_STOCK`, `NOT_ENOUGH_STOCK`, `OVER_LIMIT` (more than the purchase limit for that product, all variants together).

### `POST /api/orders`
Places an order. Same rules as the website form. Phone may be typed as `+880 1712-345678`; it is stored as `01712345678`.
```zsh
curl -s -X POST localhost:8080/api/orders -H 'Content-Type: application/json' -d '{
  "items": [{"variantId": 13, "qty": 1}],
  "deliveryAreaId": 1,
  "name": "Test Buyer", "phone": "01700000001", "email": "",
  "area": "Mirpur 10", "address": "House 1, Road 2, Block C, near the mosque",
  "courierNote": "", "isGift": false, "giftName": "", "giftPhone": "", "giftNote": "", "hidePrices": false
}'
```
`201`:
```json
{"orderNumber": "DRK-7K3Q9P", "trackToken": "<secret, shown only now>", "order": OrderView}
```
Refusals: `422 VALIDATION` (with `fields`), `422 UNKNOWN_AREA`, `403 PHONE_BLOCKED`, `409 OUT_OF_STOCK` / `PURCHASE_LIMIT` / `UNAVAILABLE` (with `problems`). On any refusal nothing is saved and no stock is taken.

An **OrderView** (no name, phone, email or address on purpose):
```json
{
  "orderNumber": "DRK-7K3Q9P", "status": "PENDING", "placedAt": "2026-10-16T02:25:08+06:00",
  "items": [{"productName": "Card Sleeves · Ember 100", "variantName": "Box of 100", "qty": 1,
             "unitPricePaisa": 35000, "lineTotalPaisa": 35000}],
  "subtotalPaisa": 35000, "deliveryPaisa": 6000, "totalPaisa": 41000, "currency": "BDT",
  "paymentMethod": "COD", "zoneCode": "INSIDE_DHAKA", "isGift": false,
  "timeline": [{"status": "PENDING", "at": "2026-10-16T02:25:08+06:00", "by": "CUSTOMER", "note": "Order placed"}],
  "canCancel": true, "cancelReason": null, "codConfirmHours": 48, "confirmBy": "2026-10-18T02:25:08+06:00"
}
```

### `POST /api/orders/track`
Order number + phone, **or** order number + the saved token. Wrong number, wrong phone and wrong token all give the same `404 ORDER_NOT_FOUND`.
```zsh
curl -s -X POST localhost:8080/api/orders/track -H 'Content-Type: application/json' \
  -d '{"orderNumber":"DRK-7K3Q9P","phone":"01700000001"}'
curl -s -X POST localhost:8080/api/orders/track -H 'Content-Type: application/json' \
  -d '{"orderNumber":"DRK-7K3Q9P","token":"<trackToken>"}'
# {"order": OrderView}
```

### `POST /api/orders/cancel`
Same lookup, plus an optional `reason` (max 200 letters). Only while PENDING or CONFIRMED (otherwise `409 CANNOT_CANCEL`). The stock goes back, and a SOLD_OUT product with stock again becomes ACTIVE.
```zsh
curl -s -X POST localhost:8080/api/orders/cancel -H 'Content-Type: application/json' \
  -d '{"orderNumber":"DRK-7K3Q9P","phone":"01700000001","reason":"Ordered the wrong size"}'
# {"order": OrderView with "status":"CANCELLED", "cancelReason":"Cancelled by the buyer: Ordered the wrong size"}
```

## Background sweep (no endpoint)

Runs when the server starts and every 10 minutes:
- PENDING orders older than `cod_confirm_hours` → CANCELLED by SYSTEM, stock back.
- SOLD_OUT products older than `archive_after_days` → ARCHIVED.

## Admin API (`/api/admin/...`)

Only for the Owner. Never linked from the shop.

**Rules for every admin request**
- A **session cookie** (`drakon_admin`, HttpOnly, Secure, SameSite=Lax, Path=/api/admin) is needed for everything except login. No cookie, a wrong one or an expired one → `401 UNAUTHORIZED`. A session ends after 12 hours without use, and 7 days after login at the latest.
- Every change (POST, PUT, PATCH, DELETE) needs an **`Origin`** header from `ALLOWED_ORIGINS` (dev: `http://localhost:5173`). Otherwise → `403 BAD_ORIGIN`. Browsers send it by themselves; curl needs `-H 'Origin: …'`.
- Answers carry `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- These answers contain personal data (name, phone, address). The server never writes them to its log.

**Admin error codes** (same shape as above): `401 UNAUTHORIZED`, `401 INVALID_LOGIN`, `403 BAD_ORIGIN`, `404 ORDER_NOT_FOUND`, `404 NOT_FOUND`, `409 BAD_TRANSITION`, `409 NOT_DRAFT`, `409 CANNOT_PUBLISH`, `409 PRICES_CHANGED`, `409 PRICE_LOCKED`, `409 LOCKED`, `409 NOT_LIVE`, `409 STOCK_BELOW_ZERO`, `409 LIMITED_NO_RESTOCK`, `409 NOT_SOLD_OUT`, `409 NOT_ARCHIVED`, `409 ARCHIVED`, `409 LAST_PHOTO`, `409 ZONE_IN_USE`, `409 NOT_DELIVERED`, `409 RETURN_WINDOW_OVER`, `409 TOO_MANY_PIECES`, `409 REFUND_TOO_HIGH`, `409 NOT_PAID`, `422 VALIDATION` (with `fields`).

Set these once in your terminal for the examples (`-c` saves the cookie into the jar file, `-b` sends it):
```zsh
J=/tmp/drakon-jar                       # cookie jar file
O='Origin: http://localhost:5173'       # the allowed origin in dev
H='Content-Type: application/json'
A=localhost:8080/api/admin
```

### Login

#### `POST /api/admin/login`
```zsh
PW=$(grep '^DEV_ADMIN_PASSWORD=' ../.env | cut -d= -f2-)    # run from api/
curl -s -c $J -H "$O" -H "$H" -d "{\"email\":\"owner@drakon.local\",\"password\":\"$PW\"}" $A/login
unset PW
# {"admin":{"id":1,"email":"owner@drakon.local","role":"OWNER"}}   + Set-Cookie: drakon_admin=...
```
A wrong email, a wrong password and a paused account all answer the same `401 INVALID_LOGIN` ("Wrong email or password. After 5 wrong tries in a row, login pauses for 15 minutes."). The numbers are the settings `login_max_failures` and `login_lockout_minutes`.

#### `GET /api/admin/me` · `POST /api/admin/logout`
```zsh
curl -s $A/me                            # {"error":{"code":"UNAUTHORIZED","message":"Please log in."}}
curl -s -b $J $A/me                      # {"admin":{"id":1,"email":"owner@drakon.local","role":"OWNER"}}
curl -s -b $J -c $J -X POST -H "$O" $A/logout   # {"ok":true}  (the session row is deleted)
curl -s -b $J -X POST -H 'Origin: https://evil.example' $A/logout   # 403 BAD_ORIGIN
```

### Orders

The auto-cancel sweep runs before every order read or change, so an order past `cod_confirm_hours` is already CANCELLED when you see it.

#### `GET /api/admin/dashboard`
```zsh
curl -s -b $J $A/dashboard
# {"counts":{"CANCELLED":1,"CONFIRMED":0,"DELIVERED":0,"PENDING":2,"SHIPPED":0},
#  "placedToday":{"orders":2,"totalPaisa":82000},"deliveredToday":{"orders":0,"totalPaisa":0},
#  "deliveredLast7Days":{"orders":0,"totalPaisa":0},"currency":"BDT"}
```
"Today" starts at midnight Bangladesh time. Sales = DELIVERED orders, by their delivery time.

#### `GET /api/admin/orders?status=&q=&limit=&offset=`
Newest first. `status` = PENDING / CONFIRMED / SHIPPED / DELIVERED / CANCELLED. `q` finds the order number, the buyer's name or the phone (any format). `limit` 1–100 (default 50).
```zsh
curl -s -b $J "$A/orders?status=PENDING"
curl -s -b $J "$A/orders?q=01712"
# {"orders":[{"orderNumber":"DRK-7K3Q9P","status":"PENDING","name":"…","phone":"01712345678","district":"Dhaka",
#   "districtArea":"Dhaka city","zoneCode":"INSIDE_DHAKA","itemCount":1,"totalPaisa":41000,"currency":"BDT",
#   "placedAt":"…","cancelsAt":"…"}], "total":1, "limit":50, "offset":0}
```

#### `GET /api/admin/orders/call-list`
PENDING orders, the oldest first, with the time left before the automatic cancel.
```zsh
curl -s -b $J $A/orders/call-list
# {"orders":[{"orderNumber":"DRK-7K3Q9P","name":"…","phone":"…","totalPaisa":41000,"placedAt":"…",
#   "cancelsAt":"…","minutesLeft":2861, …}], "codConfirmHours":48}
```

#### `GET /api/admin/orders/{number}`
Everything: `customer` (name, phone, email), `delivery` (district, area, address, courier note, zone), `gift`, `courier`, `items` (with `id`, SKU, photo, `returnedQty`), totals, `payments`, `timeline` (who: CUSTOMER / ADMIN with `adminEmail` / SYSTEM), `nextMoves`, `cancelsAt`, `adminNote`, `phoneHistory` (the phone's other orders by status), `phoneBlocked`, `returnUntil`, `refundedPaisa`; plus `returns`.
```zsh
curl -s -b $J $A/orders/DRK-7K3Q9P
# {"order":{…}, "returns":[]}
```

#### `POST /api/admin/orders/{number}/status`
`{to, reason, courierName, trackingCode}`. Allowed moves only:

| From | To |
|---|---|
| PENDING | CONFIRMED, CANCELLED |
| CONFIRMED | SHIPPED (`courierName` + `trackingCode` required), CANCELLED |
| SHIPPED | DELIVERED (the COD payment becomes COLLECTED), CANCELLED |

Every cancel needs a `reason`, puts the stock back (`inventory_movements` CANCEL) and makes a SOLD_OUT product with stock again ACTIVE. Each move is one transaction with a history row that keeps the admin id. Anything else → `409 BAD_TRANSITION`. Answers like `GET /orders/{number}`.
```zsh
curl -s -b $J -H "$O" -H "$H" -d '{"to":"CONFIRMED"}' $A/orders/DRK-7K3Q9P/status
curl -s -b $J -H "$O" -H "$H" -d '{"to":"SHIPPED","courierName":"Steadfast","trackingCode":"SF-4471029"}' $A/orders/DRK-7K3Q9P/status
curl -s -b $J -H "$O" -H "$H" -d '{"to":"DELIVERED"}' $A/orders/DRK-7K3Q9P/status
curl -s -b $J -H "$O" -H "$H" -d '{"to":"CANCELLED","reason":"Customer did not answer 3 calls"}' $A/orders/DRK-AB23CD/status
```

#### `PUT /api/admin/orders/{number}/note`
The internal note (max 2,000 letters). The buyer never sees it.
```zsh
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"note":"Wants evening delivery"}' $A/orders/DRK-7K3Q9P/note
```

#### `POST /api/admin/orders/{number}/returns`
Only DELIVERED orders, within `return_days` after delivery.
```zsh
curl -s -b $J -H "$O" -H "$H" -d '{
  "reasonType":"COMPANY_FAULT", "note":"Arrived with a torn seam", "deliveryPaidBy":"COMPANY",
  "conditionChecked":false, "refundPaisa":245000, "refundMethod":"BKASH", "refundRef":"BK8XQ2P1",
  "items":[{"orderItemId":12,"qty":1,"resellable":false}]
}' $A/orders/DRK-7K3Q9P/returns
```
- `reasonType`: `COMPANY_FAULT` (then `deliveryPaidBy` must be `COMPANY`) or `OTHER` (then `conditionChecked` must be true: unused, tags on, seal not opened).
- `items`: order line ids from `GET /orders/{number}` (`items[].id`); never more than bought minus earlier returns (`409 TOO_MANY_PIECES`).
- `refundPaisa`: all refunds together never more than the money collected (`409 REFUND_TOO_HIGH`). With a refund, `refundMethod` is `BKASH`, `NAGAD` or `CASH`; bKash and Nagad need `refundRef`.
- `resellable: true` → the pieces go back to stock (`inventory_movements` RETURN). Fully refunded → the payment becomes REFUNDED.

### Blocked phones

```zsh
curl -s -b $J $A/blocked-phones
# {"phones":[{"phone":"01712345678","reason":"Refused 3 orders","blockedAt":"…","blockedBy":"owner@drakon.local"}]}
curl -s -b $J -H "$O" -H "$H" -d '{"phone":"01712345678","reason":"Refused 3 orders"}' $A/blocked-phones
curl -s -b $J -H "$O" -H "$H" -d '{"phone":"01712345678"}' $A/blocked-phones/unblock
```
Unblocking is a POST with the phone in the body (not in the URL), so the phone never lands in a log.

### Products

There is **no DELETE** for products or variants. New products are always DRAFT.

#### `GET /api/admin/products?status=&category=&q=`
Any status. `status` = DRAFT / ACTIVE / SOLD_OUT / ARCHIVED, `category` = category slug, `q` = name or SKU.
```zsh
curl -s -b $J "$A/products?status=ACTIVE&category=clothes"
# {"products":[{"id":2,"slug":"…","name":"…","status":"ACTIVE","isLimited":true,"categoryName":"Clothes",
#   "thumb":"/img/…","variantCount":4,"emptyVariants":1,"totalStock":13,"minPricePaisa":245000,
#   "maxPricePaisa":245000, …}], "counts":{"ACTIVE":7,"ARCHIVED":3,"DRAFT":0,"SOLD_OUT":0}}
```

#### `POST /api/admin/products` · `GET /api/admin/products/{id}` · `PUT /api/admin/products/{id}`
The product form (prices are in the variants):
```zsh
curl -s -b $J -H "$O" -H "$H" -d '{
  "name":"Founders Playcard Deck · II", "slug":"", "categorySlug":"playcards", "kind":"Collectible card",
  "variantKind":"Finish", "isLimited":true, "editionSize":200, "purchaseLimit":2,
  "summary":"The second Founders deck.", "story":["First paragraph.","Second paragraph."],
  "details":[{"term":"Cards","text":"54 cards, 330 gsm"}], "successorSlug":null, "featuredOrder":null
}' $A/products
# 201 {"product":{"id":11,"slug":"founders-playcard-deck-ii","status":"DRAFT", …, "images":[], "variants":[],
#      "events":[], "movements":[], "publishProblems":["Add at least one photo.","Add at least one active variant with a price."]}}
curl -s -b $J $A/products/11
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{ …the same fields… }' $A/products/11
```
Empty `slug` = made from the name. `purchaseLimit` 1–50 or null (the default setting). Once a product has left DRAFT, `slug`, `isLimited` and `editionSize` are locked (`409 LOCKED`).

#### Variants: `POST /api/admin/products/{id}/variants` · `PUT /api/admin/variants/{id}`
```zsh
curl -s -b $J -H "$O" -H "$H" -d '{"sku":"FPD2-STD","label":"Standard","note":"","pricePaisa":160000,"imageIndex":null,"sortOrder":0}' $A/products/11/variants
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"sku":"FPD2-STD","label":"Standard","note":"","pricePaisa":160000,"imageIndex":0,"sortOrder":0,"isActive":false}' $A/variants/31
```
A new variant has stock 0. `pricePaisa` and `sku` change only while the product is a DRAFT (`409 PRICE_LOCKED` / `LOCKED`). `isActive: false` hides it from the shop (left out = unchanged).
- A new variant on a product that is no longer a DRAFT needs a `reason` (5–300 letters, else `422` with `fields.reason`) and leaves a `PRICE_FIX` record with no old price and the new price:
  `-d '{"sku":"SLV-50","label":"Box of 50","note":"","pricePaisa":20000,"imageIndex":null,"sortOrder":1,"reason":"A smaller box for new players"}'`
- Turning a variant off or on re-checks the product: a limited ACTIVE product with nothing left on sale becomes SOLD_OUT, and a SOLD_OUT product with stock on sale again becomes ACTIVE (both recorded with the admin id).

#### Stock: `POST /api/admin/variants/{id}/stock`
```zsh
curl -s -b $J -H "$O" -H "$H" -d '{"change":150,"reason":"RESTOCK","note":"150 decks from the printer"}' $A/variants/31/stock
curl -s -b $J -H "$O" -H "$H" -d '{"change":-2,"reason":"ADJUST","note":"Two arrived broken"}' $A/variants/31/stock
```
A note is required; RESTOCK must add. Never below 0 (`409 STOCK_BELOW_ZERO`). A limited product that is SOLD_OUT or ARCHIVED never gets new pieces (`409 LIMITED_NO_RESTOCK`). Every change writes `inventory_movements` with the admin id.

#### Owner price fix: `POST /api/admin/variants/{id}/price-fix`
Only on an ACTIVE product, with a reason. Records PRICE_FIX with the old and new price. Placed orders keep their price.
```zsh
curl -s -b $J -H "$O" -H "$H" -d '{"pricePaisa":165000,"reason":"The printer raised the paper price"}' $A/variants/31/price-fix
```

#### Photos
```zsh
curl -s -b $J -H "$O" -H "$H" -d '{"url":"/img/p-my-deck.webp","thumbUrl":"/img/t-p-my-deck.webp","shortName":"Front","alt":"The deck box, front"}' $A/products/11/images
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"url":"/img/p-my-deck.webp","thumbUrl":"","shortName":"Front","alt":"New words"}' $A/images/40
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"ids":[41,40]}' $A/products/11/images/order
curl -s -b $J -X DELETE -H "$O" $A/images/41
```
`url` is a file in `web/public/img` (`/img/name.webp|jpg|png|avif`) or an `https://` link. `alt` is required. The first photo is the cover. Moving or removing photos keeps each variant's `imageIndex` on the same photo. A published product keeps at least one photo (`409 LAST_PHOTO`).

#### Lifecycle
```zsh
# DRAFT -> ACTIVE: send exactly the prices you checked
curl -s -b $J -H "$O" -H "$H" -d '{"prices":[{"variantId":31,"pricePaisa":160000}]}' $A/products/11/publish
# SOLD_OUT -> ARCHIVED
curl -s -b $J -H "$O" -H "$H" -d '{"reason":"Done with this run"}' $A/products/7/archive
# ARCHIVED -> ACTIVE (Owner, reason of at least 10 letters, recorded)
curl -s -b $J -H "$O" -H "$H" -d '{"reason":"Collectors asked for a second batch"}' $A/products/7/reactivate
```
Publish needs a photo and an active priced variant (and stock for a limited run): `409 CANNOT_PUBLISH`; the confirmed prices must match: `409 PRICES_CHANGED`.

### Categories

```zsh
curl -s -b $J $A/categories          # all, also the ones turned off, with productCount
curl -s -b $J -H "$O" -H "$H" -d '{"name":"Board games","slug":"","image":"/img/cat-tech.webp"}' $A/categories
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"name":"Apparel","image":"/img/cat-clothes.webp","isActive":false}' $A/categories/4
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"ids":[5,1,2,3,4]}' $A/categories/order
```
Never deleted. The slug cannot change. Turned off, a category leaves the shop's menu; its products stay.

### Settings

```zsh
curl -s -b $J $A/settings
# {"settings":[{"key":"cod_confirm_hours","label":"…","kind":"int","min":1,"max":168,"unit":"hours","value":48,
#   "description":"…","updatedAt":"…"}, …]}
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"values":{"cod_confirm_hours":36,"home_hero_product_slug":"night-striker-football"}}' $A/settings
```
All or nothing (`422` with one message per bad key). Limits: `cod_confirm_hours` 1–168, `default_purchase_limit` 1–50, `return_days` 0–30, `archive_after_days` 0–90, `low_stock_threshold` 0–100, note limits 20–500, `login_max_failures` 3–20, `login_lockout_minutes` 1–1440, `free_delivery_enabled` true/false, `home_hero_product_slug` a published product or `""`.

### Delivery

```zsh
curl -s -b $J $A/delivery            # {"zones":[…], "areas":[…65 rows…], "freeDeliveryEnabled":false}
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"name":"Inside Dhaka","chargePaisa":7000,"freeOverPaisa":300000,"isActive":true}' $A/delivery/zones/1
curl -s -b $J -H "$O" -H "$H" -d '{"code":"CTG_CITY","name":"Chattogram city","chargePaisa":8000,"freeOverPaisa":null}' $A/delivery/zones
curl -s -b $J -H "$O" -H "$H" -d '{"district":"Chattogram","label":"Chattogram city","hint":"Inside the city corporation","zoneId":3}' $A/delivery/areas
curl -s -b $J -X PUT -H "$O" -H "$H" -d '{"label":"Outside Chattogram city","hint":"","zoneId":2,"isActive":true}' $A/delivery/areas/10
```
A zone that still has areas cannot be turned off (`409 ZONE_IN_USE`). A district with two or more areas asks the buyer to choose. The shop uses new values on its next request; placed orders keep their charge.

## Not built yet (on purpose)

Customer accounts, email, rate limiting, online payments, a VOID payment status, photo uploads (Cloudflare R2). See `docs/open-questions.md`.
