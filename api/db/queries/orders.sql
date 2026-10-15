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
