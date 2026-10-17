-- Admin product queries. Products are never deleted: there is no DELETE
-- for products or variants here, on purpose.

-- name: ListAdminProducts :many
-- Every product in any status, with its stock and price range.
-- status, category and pattern are optional (NULL = all).
SELECT p.id, p.slug, p.name, p.status, p.is_limited, p.featured_order, p.sold_out_at, p.archived_at,
       c.slug AS category_slug, c.name AS category_name,
       COALESCE((SELECT sum(v.stock) FROM product_variants v WHERE v.product_id = p.id AND v.is_active), 0)::int AS total_stock,
       (SELECT count(*) FROM product_variants v WHERE v.product_id = p.id)::int AS variant_count,
       (SELECT count(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND v.stock = 0)::int AS empty_variants,
       COALESCE((SELECT min(v.price_paisa) FROM product_variants v WHERE v.product_id = p.id AND v.is_active), 0)::bigint AS min_price_paisa,
       COALESCE((SELECT max(v.price_paisa) FROM product_variants v WHERE v.product_id = p.id AND v.is_active), 0)::bigint AS max_price_paisa,
       COALESCE((SELECT i.thumb_url FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.id LIMIT 1), '')::text AS thumb
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE (sqlc.narg('status')::product_status IS NULL OR p.status = sqlc.narg('status'))
  AND (sqlc.narg('category')::text IS NULL OR c.slug = sqlc.narg('category'))
  AND (sqlc.narg('pattern')::text IS NULL
       OR p.name ILIKE sqlc.narg('pattern')
       OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.sku ILIKE sqlc.narg('pattern')))
ORDER BY p.updated_at DESC, p.id DESC;

-- name: CountProductsByStatus :many
SELECT status, count(*) AS n FROM products GROUP BY status;

-- name: GetAdminProduct :one
SELECT p.id, p.slug, p.name, p.kind, p.variant_kind, p.summary, p.story, p.status, p.is_limited,
       p.edition_size, p.purchase_limit, p.featured_order, p.sold_out_at, p.archived_at,
       p.created_at, p.updated_at, c.slug AS category_slug, c.name AS category_name,
       s.slug AS successor_slug
FROM products p
JOIN categories c ON c.id = p.category_id
LEFT JOIN products s ON s.id = p.successor_id
WHERE p.id = $1;

-- name: LockProduct :one
-- FOR UPDATE: one change to a product at a time.
SELECT id, status, is_limited FROM products WHERE id = $1 FOR UPDATE;

-- name: ListAdminVariants :many
SELECT id, sku, label, note, price_paisa, currency, stock, image_index, sort_order, is_active
FROM product_variants
WHERE product_id = $1
ORDER BY sort_order, id;

-- name: ListAdminImages :many
SELECT id, url, thumb_url, short_name, alt, sort_order
FROM product_images
WHERE product_id = $1
ORDER BY sort_order, id;

-- name: ListAdminDetails :many
SELECT term, text FROM product_details WHERE product_id = $1 ORDER BY sort_order, id;

-- name: ListProductEvents :many
SELECT e.type, e.actor, e.reason, e.old_value, e.new_value, e.created_at, a.email AS admin_email
FROM product_events e
LEFT JOIN admins a ON a.id = e.by_admin_id
WHERE e.product_id = $1
ORDER BY e.created_at DESC, e.id DESC
LIMIT 50;

-- name: ListProductMovements :many
SELECT m.variant_id, v.sku, m.change, m.reason, m.note, m.created_at, o.order_number, a.email AS admin_email
FROM inventory_movements m
JOIN product_variants v ON v.id = m.variant_id
LEFT JOIN orders o ON o.id = m.order_id
LEFT JOIN admins a ON a.id = m.by_admin_id
WHERE v.product_id = $1
ORDER BY m.created_at DESC, m.id DESC
LIMIT 30;

-- name: GetCategoryIDBySlug :one
SELECT id FROM categories WHERE slug = $1;

-- name: GetProductIDBySlugAny :one
-- Any status (the admin may point to a DRAFT successor).
SELECT id FROM products WHERE slug = $1;

-- name: InsertProduct :one
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, successor_id, featured_order, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT', $8, $9, $10, $11, $12, sqlc.arg('at'), sqlc.arg('at'))
RETURNING id;

-- name: UpdateProduct :exec
UPDATE products
SET category_id = $2, slug = $3, name = $4, kind = $5, variant_kind = $6, summary = $7, story = $8,
    is_limited = $9, edition_size = $10, purchase_limit = $11, successor_id = $12, featured_order = $13,
    updated_at = sqlc.arg('at')
WHERE id = $1;

-- name: DeleteProductDetails :exec
-- Details are rows of the product's "Details" table; saving the product
-- writes them again in the new order. (The product itself is never deleted.)
DELETE FROM product_details WHERE product_id = $1;

-- name: InsertProductDetail :exec
INSERT INTO product_details (product_id, term, text, sort_order) VALUES ($1, $2, $3, $4);

-- name: SetProductStatus :exec
-- Publish, archive and reactivate. sold_out_at and archived_at follow the status.
UPDATE products
SET status = sqlc.arg('status'), sold_out_at = sqlc.narg('sold_out_at'), archived_at = sqlc.narg('archived_at'),
    updated_at = sqlc.arg('at')
WHERE id = sqlc.arg('id');

-- name: TouchProduct :exec
UPDATE products SET updated_at = sqlc.arg('at') WHERE id = sqlc.arg('id');

-- name: InsertVariant :one
INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order, is_active)
VALUES ($1, $2, $3, $4, $5, 0, $6, $7, true)
RETURNING id;

-- name: LockVariant :one
-- Locks the variant row first (orders lock variants before products too,
-- so the two never wait for each other in a circle).
SELECT v.id, v.product_id, v.price_paisa, v.stock, v.sku, v.is_active
FROM product_variants v
WHERE v.id = $1
FOR UPDATE;

-- name: UpdateVariant :exec
UPDATE product_variants
SET sku = $2, label = $3, note = $4, price_paisa = $5, image_index = $6, sort_order = $7, is_active = $8
WHERE id = $1;

-- name: SetVariantPrice :exec
UPDATE product_variants SET price_paisa = $2 WHERE id = $1;

-- name: ChangeStock :one
-- The stock can never go below 0: 0 rows back = refused.
UPDATE product_variants
SET stock = stock + sqlc.arg('change')
WHERE id = sqlc.arg('id') AND stock + sqlc.arg('change') >= 0
RETURNING stock;

-- name: CountProductImages :one
SELECT count(*)::int FROM product_images WHERE product_id = $1;

-- name: CountPublishableVariants :one
SELECT count(*)::int FROM product_variants WHERE product_id = $1 AND is_active AND price_paisa > 0;

-- name: ActiveStock :one
SELECT COALESCE(sum(stock), 0)::int FROM product_variants WHERE product_id = $1 AND is_active;

-- name: InsertImage :one
INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
VALUES ($1, $2, $3, $4, $5,
        (SELECT COALESCE(max(sort_order) + 1, 0) FROM product_images WHERE product_id = $1))
RETURNING id;

-- name: GetImage :one
SELECT id, product_id, url, thumb_url, short_name, alt, sort_order FROM product_images WHERE id = $1;

-- name: UpdateImage :exec
UPDATE product_images SET url = $2, thumb_url = $3, short_name = $4, alt = $5 WHERE id = $1;

-- name: SetImageOrder :exec
UPDATE product_images SET sort_order = $2 WHERE id = $1;

-- name: DeleteImage :exec
-- Only the photo row goes; the product stays.
DELETE FROM product_images WHERE id = $1;

-- name: SetVariantImageIndex :exec
UPDATE product_variants SET image_index = $2 WHERE id = $1;
