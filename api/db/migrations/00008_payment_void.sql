-- Payment status VOID (open question 8, decided 2026-10-25).
-- A cancelled Cash on Delivery order has nothing to collect: its PENDING
-- payment becomes VOID (orders.CancelLocked). COLLECTED and REFUNDED are
-- never changed by a cancel.
-- PostgreSQL cannot use a new enum value in the same transaction that
-- added it, so this file runs without a transaction and only adds the
-- value; 00009 uses it.
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose NO TRANSACTION

-- +goose Up
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'VOID';

-- +goose Down
-- PostgreSQL cannot drop one enum value: build the type again without it.
-- (00009's Down has already turned every VOID back into PENDING.)
ALTER TYPE payment_status RENAME TO payment_status_old;
CREATE TYPE payment_status AS ENUM ('PENDING', 'COLLECTED', 'REFUNDED');
ALTER TABLE payments ALTER COLUMN status DROP DEFAULT;
ALTER TABLE payments ALTER COLUMN status TYPE payment_status USING status::text::payment_status;
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'PENDING';
DROP TYPE payment_status_old;
