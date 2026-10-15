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
| 400 | `BAD_JSON`, `UNKNOWN_FIELD`, `BAD_QUERY`, `EMPTY_CART`, `BAD_CART`, `CART_TOO_LARGE` |
| 403 | `PHONE_BLOCKED` |
| 404 | `NOT_FOUND`, `ORDER_NOT_FOUND` |
| 409 | `OUT_OF_STOCK`, `PURCHASE_LIMIT`, `UNAVAILABLE`, `CANNOT_CANCEL` |
| 413 | `BODY_TOO_LARGE` (bodies are limited to 1 MB) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` (send `Content-Type: application/json`) |
| 422 | `VALIDATION`, `UNKNOWN_AREA`, `BAD_LOOKUP` |
| 500 | `INTERNAL` (details only in the server log, never in the answer) |
| 503 | `DATABASE_DOWN` |

Unknown JSON fields are refused (`UNKNOWN_FIELD`). That is how a `pricePaisa` sent by a browser is stopped.

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

## Not built yet (on purpose)

Admin API and login, customer accounts, email, rate limiting, online payments. See `docs/open-questions.md`.
