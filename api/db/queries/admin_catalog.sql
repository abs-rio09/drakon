-- Admin categories, settings and delivery. Categories are never deleted:
-- they are turned off (is_active = false) instead.

-- name: ListAdminCategories :many
SELECT c.id, c.slug, c.name, c.image_url, c.sort_order, c.is_active,
       (SELECT count(*) FROM products p WHERE p.category_id = c.id)::int AS product_count
FROM categories c
ORDER BY c.sort_order, c.id;

-- name: InsertCategory :one
INSERT INTO categories (slug, name, image_url, sort_order, is_active)
VALUES ($1, $2, $3, (SELECT COALESCE(max(sort_order) + 1, 1) FROM categories), $4)
RETURNING id;

-- name: UpdateCategory :execrows
UPDATE categories SET name = $2, image_url = $3, is_active = $4 WHERE id = $1;

-- name: SetCategoryOrder :exec
UPDATE categories SET sort_order = $2 WHERE id = $1;

-- name: ListAllSettings :many
SELECT key, value, description, updated_at FROM settings ORDER BY key;

-- name: UpdateSetting :execrows
UPDATE settings SET value = $2, updated_at = sqlc.arg('at') WHERE key = $1;

-- name: ProductSlugOnSale :one
-- For the home hero: a product the shop can show (not a draft).
SELECT EXISTS (SELECT 1 FROM products WHERE slug = $1 AND status <> 'DRAFT');

-- name: ListAdminZones :many
SELECT z.id, z.code, z.name, z.charge_paisa, z.free_over_paisa, z.currency, z.sort_order, z.is_active,
       (SELECT count(*) FROM delivery_areas a WHERE a.zone_id = z.id AND a.is_active)::int AS active_areas
FROM delivery_zones z
ORDER BY z.sort_order, z.id;

-- name: ListAdminAreas :many
SELECT a.id, a.district, a.area_label, a.hint, a.zone_id, a.sort_order, a.is_active
FROM delivery_areas a
ORDER BY a.district, a.sort_order, a.id;

-- name: InsertZone :one
INSERT INTO delivery_zones (code, name, charge_paisa, free_over_paisa, sort_order, is_active)
VALUES ($1, $2, $3, $4, (SELECT COALESCE(max(sort_order) + 1, 1) FROM delivery_zones), true)
RETURNING id;

-- name: UpdateZone :execrows
UPDATE delivery_zones SET name = $2, charge_paisa = $3, free_over_paisa = $4, is_active = $5 WHERE id = $1;

-- name: CountActiveAreasInZone :one
SELECT count(*)::int FROM delivery_areas WHERE zone_id = $1 AND is_active;

-- name: ZoneExists :one
SELECT EXISTS (SELECT 1 FROM delivery_zones WHERE id = $1);

-- name: InsertArea :one
INSERT INTO delivery_areas (district, area_label, hint, zone_id, sort_order, is_active)
VALUES ($1, $2, $3, $4,
        (SELECT COALESCE(max(sort_order) + 1, 0) FROM delivery_areas WHERE district = $1), true)
RETURNING id;

-- name: UpdateArea :execrows
UPDATE delivery_areas SET area_label = $2, hint = $3, zone_id = $4, is_active = $5 WHERE id = $1;

-- name: DistrictExists :one
SELECT EXISTS (SELECT 1 FROM delivery_areas WHERE district = $1);
