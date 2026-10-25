-- 1. Old cancelled COD orders: their PENDING payment becomes VOID, like a
--    cancel does from now on (open question 8, decided 2026-10-25).
-- 2. Only 'BDT' is a valid currency today (blueprint: Bangladesh only), so
--    every currency column gets a CHECK. The Go code always writes 'BDT';
--    this makes the database refuse anything else too.
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up
UPDATE payments p SET status = 'VOID'
FROM orders o
WHERE o.id = p.order_id AND o.status = 'CANCELLED' AND p.method = 'COD' AND p.status = 'PENDING';

ALTER TABLE product_variants ADD CONSTRAINT product_variants_currency_bdt CHECK (currency = 'BDT');
ALTER TABLE delivery_zones   ADD CONSTRAINT delivery_zones_currency_bdt   CHECK (currency = 'BDT');
ALTER TABLE orders           ADD CONSTRAINT orders_currency_bdt           CHECK (currency = 'BDT');
ALTER TABLE order_items      ADD CONSTRAINT order_items_currency_bdt      CHECK (currency = 'BDT');
ALTER TABLE payments         ADD CONSTRAINT payments_currency_bdt         CHECK (currency = 'BDT');
ALTER TABLE returns          ADD CONSTRAINT returns_currency_bdt          CHECK (currency = 'BDT');

-- +goose Down
ALTER TABLE returns          DROP CONSTRAINT returns_currency_bdt;
ALTER TABLE payments         DROP CONSTRAINT payments_currency_bdt;
ALTER TABLE order_items      DROP CONSTRAINT order_items_currency_bdt;
ALTER TABLE orders           DROP CONSTRAINT orders_currency_bdt;
ALTER TABLE delivery_zones   DROP CONSTRAINT delivery_zones_currency_bdt;
ALTER TABLE product_variants DROP CONSTRAINT product_variants_currency_bdt;
UPDATE payments SET status = 'PENDING' WHERE status = 'VOID';
