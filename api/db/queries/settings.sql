-- name: ListSettings :many
SELECT key, value FROM settings;

-- name: ListDeliveryZones :many
SELECT id, code, name, charge_paisa, free_over_paisa, currency
FROM delivery_zones
WHERE is_active
ORDER BY sort_order, id;

-- name: ListDeliveryAreas :many
SELECT a.id, a.district, a.area_label, a.hint, z.code AS zone_code
FROM delivery_areas a
JOIN delivery_zones z ON z.id = a.zone_id
WHERE a.is_active AND z.is_active
ORDER BY a.district, a.sort_order, a.id;

-- name: GetDeliveryArea :one
-- The area the buyer picked, with its zone (for the delivery charge).
SELECT a.id, a.district, a.area_label, z.code AS zone_code,
       z.charge_paisa, z.free_over_paisa,
       (SELECT count(*) FROM delivery_areas d
        WHERE d.district = a.district AND d.is_active) AS areas_in_district
FROM delivery_areas a
JOIN delivery_zones z ON z.id = a.zone_id
WHERE a.id = $1 AND a.is_active AND z.is_active;

-- name: ListAreaSuggestions :many
-- Area / Thana names the checkout suggests. city_area_id NULL = for the
-- whole district; set = only for that delivery area (Dhaka city).
SELECT district, city_area_id, name
FROM area_suggestions
WHERE is_active
ORDER BY district, name;
