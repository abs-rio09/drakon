-- Admin order work (docs/blueprint.md, part 8): an internal note per order,
-- and who blocked a phone number.
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up

-- Only admins see this note (AdminOrder.dc.html, "Internal note").
ALTER TABLE orders ADD COLUMN admin_note TEXT NOT NULL DEFAULT '';

ALTER TABLE blocked_phones ADD COLUMN blocked_by_admin_id BIGINT REFERENCES admins (id);

-- The admin list shows the newest orders first.
CREATE INDEX orders_created_at_idx ON orders (created_at);

-- +goose Down
DROP INDEX orders_created_at_idx;
ALTER TABLE blocked_phones DROP COLUMN blocked_by_admin_id;
ALTER TABLE orders DROP COLUMN admin_note;
