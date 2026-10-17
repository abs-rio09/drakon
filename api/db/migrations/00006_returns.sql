-- Returns (docs/blueprint.md, part 2 rule 3, part 8 step 6). The admin
-- records a return after the parcel came back: which pieces, whether they
-- can be sold again, who paid the delivery, and the refund (bKash, Nagad or
-- cash in hand, with its reference).
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up

-- COMPANY_FAULT: broken, wrong product, wrong size. OTHER: any other reason.
CREATE TYPE return_reason AS ENUM ('COMPANY_FAULT', 'OTHER');
CREATE TYPE delivery_payer AS ENUM ('COMPANY', 'CUSTOMER');
CREATE TYPE refund_method AS ENUM ('BKASH', 'NAGAD', 'CASH');
-- Only COMPLETED today (recorded when the parcel is back). Room for
-- REQUESTED / RECEIVED later without a new table.
CREATE TYPE return_status AS ENUM ('COMPLETED');

CREATE TABLE returns (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id         BIGINT         NOT NULL REFERENCES orders (id),
    reason_type      return_reason  NOT NULL,
    note             TEXT           NOT NULL DEFAULT '',
    delivery_paid_by delivery_payer NOT NULL,
    refund_paisa     BIGINT         NOT NULL CHECK (refund_paisa >= 0),
    currency         TEXT           NOT NULL DEFAULT 'BDT',
    refund_method    refund_method, -- NULL when nothing is refunded
    refund_ref       TEXT           NOT NULL DEFAULT '', -- bKash / Nagad transaction id
    status           return_status  NOT NULL DEFAULT 'COMPLETED',
    by_admin_id      BIGINT         NOT NULL REFERENCES admins (id),
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    -- Money refunded always says how.
    CHECK (refund_paisa = 0 OR refund_method IS NOT NULL),
    -- Blueprint rule 3: the company's mistake = the company pays the delivery.
    CHECK (reason_type <> 'COMPANY_FAULT' OR delivery_paid_by = 'COMPANY')
);

CREATE INDEX returns_order_id_idx ON returns (order_id);

CREATE TABLE return_items (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    return_id     BIGINT  NOT NULL REFERENCES returns (id),
    order_item_id BIGINT  NOT NULL REFERENCES order_items (id),
    variant_id    BIGINT  NOT NULL REFERENCES product_variants (id),
    qty           INTEGER NOT NULL CHECK (qty > 0),
    -- true = back on the shelf (stock +qty, inventory_movements RETURN)
    resellable    BOOLEAN NOT NULL
);

CREATE INDEX return_items_return_id_idx ON return_items (return_id);
CREATE INDEX return_items_order_item_id_idx ON return_items (order_item_id);

-- +goose Down
DROP TABLE return_items;
DROP TABLE returns;
DROP TYPE return_status;
DROP TYPE refund_method;
DROP TYPE delivery_payer;
DROP TYPE return_reason;
