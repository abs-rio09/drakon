-- Checkout and order queries.

-- name: GetVariantsForCheckout :many
-- Everything checkout needs to price and check each cart line. The price
-- always comes from here, never from the browser.
SELECT v.id AS variant_id, v.label, v.price_paisa, v.currency, v.stock, v.is_active,
       p.id AS product_id, p.slug AS product_slug, p.name AS product_name,
       p.variant_kind, p.status AS product_status, p.is_limited, p.purchase_limit,
       COALESCE(
           (SELECT i.thumb_url FROM product_images i
            WHERE i.product_id = p.id
            ORDER BY (i.sort_order = v.image_index) DESC NULLS LAST, i.sort_order, i.id
            LIMIT 1),
           '')::text AS thumb
FROM product_variants v
JOIN products p ON p.id = v.product_id
WHERE v.id = ANY(sqlc.arg('ids')::bigint[]);

-- name: IsPhoneBlocked :one
SELECT EXISTS (SELECT 1 FROM blocked_phones WHERE phone = $1);

-- name: LockPhone :exec
-- Holds a lock on this phone number until the transaction ends, so two
-- orders from the same phone at the same moment are checked one after the
-- other (otherwise both could slip past the purchase limit).
SELECT pg_advisory_xact_lock(hashtextextended(sqlc.arg('phone')::text, 0));

-- name: EarlierQtyByProduct :many
-- Pieces of each product this phone already has in orders that are not
-- cancelled (for the purchase limit).
SELECT oi.product_id, sum(oi.qty)::int AS qty
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.phone = $1 AND o.status <> 'CANCELLED'
GROUP BY oi.product_id;

-- name: DecrementStock :execrows
-- The overselling guard: 0 rows changed = not enough stock left.
UPDATE product_variants
SET stock = stock - sqlc.arg('qty')
WHERE id = sqlc.arg('id') AND is_active AND stock >= sqlc.arg('qty');

-- name: IncrementStock :exec
UPDATE product_variants SET stock = stock + sqlc.arg('qty') WHERE id = sqlc.arg('id');

-- name: InsertOrder :one
-- ON CONFLICT DO NOTHING: if the random order number already exists, no row
-- comes back and the Go code tries another number.
INSERT INTO orders (
    order_number, track_token_hash, name, phone, email,
    delivery_area_id, district, district_area, area, address, courier_note,
    is_gift, gift_receiver_name, gift_receiver_phone, gift_note, gift_hide_prices,
    zone_code, delivery_paisa, subtotal_paisa, total_paisa, currency, payment_method, status
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9, $10, $11,
    $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, 'COD', 'PENDING'
)
ON CONFLICT (order_number) DO NOTHING
RETURNING id;

-- name: InsertOrderItem :exec
INSERT INTO order_items (order_id, variant_id, product_id, product_name, variant_label,
                         unit_price_paisa, qty, line_total_paisa, currency)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: InsertInventoryMovement :exec
-- by_admin_id: the admin who made the change (NULL for the buyer or the server).
INSERT INTO inventory_movements (variant_id, change, reason, order_id, note, by_admin_id)
VALUES ($1, $2, $3, $4, $5, sqlc.narg('by_admin_id'));

-- name: InsertStatusHistory :exec
INSERT INTO order_status_history (order_id, from_status, to_status, actor, note, created_at, by_admin_id)
VALUES ($1, $2, $3, $4, $5, sqlc.arg('at'), sqlc.narg('by_admin_id'));

-- name: InsertPayment :exec
INSERT INTO payments (order_id, method, amount_paisa, currency, status)
VALUES ($1, 'COD', $2, $3, 'PENDING');

-- name: MarkSoldOutIfEmpty :one
-- A limited product whose variants are all at stock 0 becomes SOLD_OUT.
-- No row back = it still has stock (or is not limited / not ACTIVE).
UPDATE products p
SET status = 'SOLD_OUT', sold_out_at = sqlc.arg('at'), updated_at = sqlc.arg('at')
WHERE p.id = sqlc.arg('id') AND p.status = 'ACTIVE' AND p.is_limited
  AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND v.stock > 0)
RETURNING p.id;

-- name: ReactivateIfStocked :one
-- A SOLD_OUT product that has stock again (after a cancel) becomes ACTIVE.
-- ARCHIVED products stay archived: only the owner may bring them back.
UPDATE products p
SET status = 'ACTIVE', sold_out_at = NULL, updated_at = sqlc.arg('at')
WHERE p.id = sqlc.arg('id') AND p.status = 'SOLD_OUT'
  AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND v.stock > 0)
RETURNING p.id;

-- name: InsertProductEvent :exec
INSERT INTO product_events (product_id, type, actor, reason, old_value, new_value, created_at, by_admin_id)
VALUES ($1, $2, $3, $4, $5, $6, sqlc.arg('at'), sqlc.narg('by_admin_id'));

-- name: GetOrderByNumber :one
SELECT id, order_number, track_token_hash, phone, status, district, district_area,
       zone_code, delivery_paisa, subtotal_paisa, total_paisa, currency, payment_method,
       is_gift, created_at, cancelled_at, cancel_reason
FROM orders
WHERE order_number = $1;

-- name: GetOrderForUpdate :one
-- FOR UPDATE locks the order row until the transaction ends, so a buyer's
-- cancel and the auto-cancel sweep can never both cancel the same order.
SELECT id, status, created_at FROM orders WHERE id = $1 FOR UPDATE;

-- name: ListOrderItems :many
SELECT variant_id, product_id, product_name, variant_label, unit_price_paisa, qty, line_total_paisa
FROM order_items
WHERE order_id = $1
ORDER BY id;

-- name: ListStatusHistory :many
SELECT from_status, to_status, actor, note, created_at
FROM order_status_history
WHERE order_id = $1
ORDER BY created_at, id;

-- name: SetOrderCancelled :exec
UPDATE orders
SET status = 'CANCELLED', cancelled_at = sqlc.arg('at'), cancel_reason = sqlc.arg('reason'), updated_at = sqlc.arg('at')
WHERE id = sqlc.arg('id');

-- name: ListExpiredPendingOrders :many
-- PENDING orders placed before the cutoff (cod_confirm_hours ago).
SELECT id FROM orders
WHERE status = 'PENDING' AND created_at < sqlc.arg('cutoff')
ORDER BY created_at;

-- name: ArchiveOldSoldOut :many
-- SOLD_OUT products that sold out before the cutoff move to ARCHIVED.
UPDATE products
SET status = 'ARCHIVED', archived_at = sqlc.arg('at'), updated_at = sqlc.arg('at')
WHERE status = 'SOLD_OUT' AND sold_out_at < sqlc.arg('cutoff')
RETURNING id;

-- name: VoidPendingPayments :exec
-- A cancelled COD order has nothing to collect. Only PENDING changes;
-- COLLECTED and REFUNDED stay as they are.
UPDATE payments SET status = 'VOID'
WHERE order_id = $1 AND method = 'COD' AND status = 'PENDING';
