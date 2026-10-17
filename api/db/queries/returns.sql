-- Returns of delivered orders.

-- name: GetOrderForReturn :one
-- Locks the order: two returns for the same order are recorded one after
-- the other, so they can never refund or return more than was paid/sold.
SELECT id, status, delivered_at FROM orders WHERE id = $1 FOR UPDATE;

-- name: ReturnedQtyByOrderItem :many
SELECT ri.order_item_id, sum(ri.qty)::int AS qty
FROM return_items ri
JOIN returns r ON r.id = ri.return_id
WHERE r.order_id = $1
GROUP BY ri.order_item_id;

-- name: OrderItemsForReturn :many
SELECT id, variant_id, product_id, qty FROM order_items WHERE order_id = $1;

-- name: RefundedSoFar :one
SELECT COALESCE(sum(refund_paisa), 0)::bigint FROM returns WHERE order_id = $1;

-- name: CollectedPayment :one
-- The money the courier collected for this order (COD).
SELECT id, amount_paisa, status FROM payments
WHERE order_id = $1 AND status IN ('COLLECTED', 'REFUNDED')
ORDER BY id
LIMIT 1
FOR UPDATE;

-- name: SetPaymentRefunded :exec
UPDATE payments SET status = 'REFUNDED' WHERE id = $1;

-- name: InsertReturn :one
INSERT INTO returns (order_id, reason_type, note, delivery_paid_by, refund_paisa, refund_method, refund_ref, by_admin_id, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, sqlc.arg('at'))
RETURNING id;

-- name: InsertReturnItem :exec
INSERT INTO return_items (return_id, order_item_id, variant_id, qty, resellable)
VALUES ($1, $2, $3, $4, $5);

-- name: ListReturnsForOrder :many
SELECT r.id, r.reason_type, r.note, r.delivery_paid_by, r.refund_paisa, r.currency, r.refund_method,
       r.refund_ref, r.status, r.created_at, a.email AS admin_email
FROM returns r
JOIN admins a ON a.id = r.by_admin_id
WHERE r.order_id = $1
ORDER BY r.created_at, r.id;

-- name: ListReturnItemsForOrder :many
SELECT ri.return_id, ri.order_item_id, ri.qty, ri.resellable, oi.product_name, oi.variant_label
FROM return_items ri
JOIN returns r ON r.id = ri.return_id
JOIN order_items oi ON oi.id = ri.order_item_id
WHERE r.order_id = $1
ORDER BY ri.id;
