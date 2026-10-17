-- Admin order queries. These return personal data (name, phone, address):
-- only admin handlers may use them.

-- name: CountOrdersByStatus :many
SELECT status, count(*) AS n FROM orders GROUP BY status;

-- name: OrdersPlacedSince :one
SELECT count(*) AS n, COALESCE(sum(total_paisa), 0)::bigint AS total_paisa
FROM orders
WHERE created_at >= sqlc.arg('since') AND status <> 'CANCELLED';

-- name: DeliveredSalesSince :one
-- Money actually collected: DELIVERED orders, by the time they were delivered.
SELECT count(*) AS n, COALESCE(sum(total_paisa), 0)::bigint AS total_paisa
FROM orders
WHERE status = 'DELIVERED' AND delivered_at >= sqlc.arg('since');

-- name: ListAdminOrders :many
-- status and pattern are optional (NULL = all). pattern is already a LIKE
-- pattern; phone_pattern is the same text with the phone cleaned up.
SELECT o.order_number, o.status, o.name, o.phone, o.district, o.district_area, o.zone_code,
       o.total_paisa, o.currency, o.created_at, o.confirmed_at, o.shipped_at, o.delivered_at,
       o.cancelled_at, o.cancel_reason, o.courier_name,
       (SELECT COALESCE(sum(i.qty), 0) FROM order_items i WHERE i.order_id = o.id)::int AS item_count
FROM orders o
WHERE (sqlc.narg('status')::order_status IS NULL OR o.status = sqlc.narg('status'))
  AND (sqlc.narg('pattern')::text IS NULL
       OR o.order_number ILIKE sqlc.narg('pattern')
       OR o.name ILIKE sqlc.narg('pattern')
       OR o.phone LIKE sqlc.narg('phone_pattern'))
ORDER BY o.created_at DESC, o.id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountAdminOrders :one
SELECT count(*)
FROM orders o
WHERE (sqlc.narg('status')::order_status IS NULL OR o.status = sqlc.narg('status'))
  AND (sqlc.narg('pattern')::text IS NULL
       OR o.order_number ILIKE sqlc.narg('pattern')
       OR o.name ILIKE sqlc.narg('pattern')
       OR o.phone LIKE sqlc.narg('phone_pattern'));

-- name: ListCallList :many
-- Orders waiting for the confirmation call, the oldest (most urgent) first.
SELECT o.order_number, o.name, o.phone, o.district, o.district_area, o.zone_code,
       o.total_paisa, o.currency, o.created_at,
       (SELECT COALESCE(sum(i.qty), 0) FROM order_items i WHERE i.order_id = o.id)::int AS item_count
FROM orders o
WHERE o.status = 'PENDING'
ORDER BY o.created_at, o.id;

-- name: GetAdminOrder :one
SELECT id, order_number, status, name, phone, email, delivery_area_id, district, district_area,
       area, address, courier_note, is_gift, gift_receiver_name, gift_receiver_phone, gift_note,
       gift_hide_prices, zone_code, delivery_paisa, subtotal_paisa, total_paisa, currency,
       payment_method, courier_name, courier_tracking, created_at, confirmed_at, shipped_at,
       delivered_at, cancelled_at, cancel_reason, admin_note
FROM orders
WHERE order_number = $1;

-- name: ListAdminOrderItems :many
SELECT i.id, i.variant_id, i.product_id, i.product_name, i.variant_label, i.unit_price_paisa,
       i.qty, i.line_total_paisa, i.currency, v.sku, p.slug AS product_slug,
       COALESCE(
           (SELECT im.thumb_url FROM product_images im
            WHERE im.product_id = p.id
            ORDER BY (im.sort_order = v.image_index) DESC NULLS LAST, im.sort_order, im.id
            LIMIT 1),
           '')::text AS thumb
FROM order_items i
JOIN product_variants v ON v.id = i.variant_id
JOIN products p ON p.id = i.product_id
WHERE i.order_id = $1
ORDER BY i.id;

-- name: ListAdminStatusHistory :many
SELECT h.from_status, h.to_status, h.actor, h.note, h.created_at, h.by_admin_id, a.email AS admin_email
FROM order_status_history h
LEFT JOIN admins a ON a.id = h.by_admin_id
WHERE h.order_id = $1
ORDER BY h.created_at, h.id;

-- name: ListPaymentsForOrder :many
SELECT method, amount_paisa, currency, status, collected_at, ref
FROM payments
WHERE order_id = $1
ORDER BY id;

-- name: PhoneOrderCounts :many
-- The phone's OTHER orders, by status ("1 earlier order, delivered").
SELECT status, count(*) AS n
FROM orders
WHERE phone = $1 AND id <> sqlc.arg('except_id')
GROUP BY status;

-- name: SetOrderConfirmed :exec
UPDATE orders SET status = 'CONFIRMED', confirmed_at = sqlc.arg('at'), updated_at = sqlc.arg('at')
WHERE id = sqlc.arg('id');

-- name: SetOrderShipped :exec
UPDATE orders
SET status = 'SHIPPED', shipped_at = sqlc.arg('at'), courier_name = sqlc.arg('courier_name'),
    courier_tracking = sqlc.arg('courier_tracking'), updated_at = sqlc.arg('at')
WHERE id = sqlc.arg('id');

-- name: SetOrderDelivered :exec
UPDATE orders SET status = 'DELIVERED', delivered_at = sqlc.arg('at'), updated_at = sqlc.arg('at')
WHERE id = sqlc.arg('id');

-- name: CollectCODPayment :execrows
-- Cash on Delivery: the courier hands over the cash on delivery.
UPDATE payments SET status = 'COLLECTED', collected_at = sqlc.arg('at')
WHERE order_id = sqlc.arg('order_id') AND method = 'COD' AND status = 'PENDING';

-- name: SetOrderAdminNote :execrows
UPDATE orders SET admin_note = sqlc.arg('note'), updated_at = sqlc.arg('at')
WHERE order_number = sqlc.arg('order_number');

-- name: ListBlockedPhones :many
SELECT b.phone, b.reason, b.created_at, a.email AS blocked_by
FROM blocked_phones b
LEFT JOIN admins a ON a.id = b.blocked_by_admin_id
ORDER BY b.created_at DESC;

-- name: BlockPhone :exec
-- Blocking again only updates the reason.
INSERT INTO blocked_phones (phone, reason, created_at, blocked_by_admin_id)
VALUES ($1, $2, sqlc.arg('at'), sqlc.arg('by_admin_id'))
ON CONFLICT (phone) DO UPDATE SET reason = EXCLUDED.reason, blocked_by_admin_id = EXCLUDED.blocked_by_admin_id;

-- name: UnblockPhone :execrows
DELETE FROM blocked_phones WHERE phone = $1;
