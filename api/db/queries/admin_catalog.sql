-- Admin categories, settings and delivery. Categories are never deleted:
-- they are turned off (is_active = false) instead.

-- name: ListAdminCategories :many
SELECT c.id, c.slug, c.name, c.image_url, c.sort_order, c.is_active,
       (SELECT count(*) FROM products p WHERE p.category_id = c.id)::int AS product_count
FROM categories c
ORDER BY c.sort_order, c.id;
