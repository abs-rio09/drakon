-- Public catalog queries. DRAFT products are never returned.

-- name: ListCategories :many
SELECT slug, name, image_url
FROM categories
WHERE is_active
ORDER BY sort_order, id;

-- name: ListShopProducts :many
-- Products on sale. category and q are optional (NULL = no filter).
-- q is already a LIKE pattern (the Go code escapes % and _).
SELECT p.id
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.status = 'ACTIVE'
  AND (sqlc.narg('category')::text IS NULL OR c.slug = sqlc.narg('category'))
  AND (sqlc.narg('pattern')::text IS NULL
       OR p.name ILIKE sqlc.narg('pattern') OR p.kind ILIKE sqlc.narg('pattern'))
ORDER BY p.featured_order NULLS LAST, p.id
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: CountShopProducts :one
-- Same filters as ListShopProducts, for "total" in the paginated answer.
SELECT count(*)
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.status = 'ACTIVE'
  AND (sqlc.narg('category')::text IS NULL OR c.slug = sqlc.narg('category'))
  AND (sqlc.narg('pattern')::text IS NULL
       OR p.name ILIKE sqlc.narg('pattern') OR p.kind ILIKE sqlc.narg('pattern'));

-- name: ListFeaturedProductIDs :many
SELECT id FROM products
WHERE status = 'ACTIVE' AND featured_order IS NOT NULL
ORDER BY featured_order;

-- name: ListArchiveProductIDs :many
-- Sold out and archived runs, the most recent first.
SELECT id FROM products
WHERE status IN ('SOLD_OUT', 'ARCHIVED')
ORDER BY sold_out_at DESC NULLS LAST, id DESC;

-- name: GetProductIDBySlug :one
SELECT id FROM products
WHERE slug = $1 AND status <> 'DRAFT';

-- name: GetProductsByIDs :many
SELECT p.id, p.slug, p.name, c.slug AS category_slug, p.kind, p.variant_kind,
       p.summary, p.story, p.status, p.is_limited, p.edition_size, p.purchase_limit,
       p.sold_out_at, s.slug AS successor_slug
FROM products p
JOIN categories c ON c.id = p.category_id
LEFT JOIN products s ON s.id = p.successor_id AND s.status <> 'DRAFT'
WHERE p.id = ANY(sqlc.arg('ids')::bigint[]) AND p.status <> 'DRAFT';

-- name: ListDetailsForProducts :many
SELECT product_id, term, text
FROM product_details
WHERE product_id = ANY(sqlc.arg('ids')::bigint[])
ORDER BY product_id, sort_order, id;

-- name: ListImagesForProducts :many
SELECT product_id, url, thumb_url, short_name, alt
FROM product_images
WHERE product_id = ANY(sqlc.arg('ids')::bigint[])
ORDER BY product_id, sort_order, id;

-- name: ListVariantsForProducts :many
SELECT id, product_id, sku, label, note, price_paisa, currency, stock, image_index
FROM product_variants
WHERE product_id = ANY(sqlc.arg('ids')::bigint[]) AND is_active
ORDER BY product_id, sort_order, id;
