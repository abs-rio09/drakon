-- Order tables (docs/blueprint.md, part 5). Cash on Delivery only for now.
-- Orders are never deleted: a cancelled order keeps its rows and history.
-- No customer_id yet: customer accounts are not decided (open question 3).
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up

CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
-- Who made a change: the buyer, the admin, or the server itself (auto-cancel).
CREATE TYPE actor_type AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM');
-- Only COD today. bKash/Nagad later = ALTER TYPE ... ADD VALUE, no new table.
CREATE TYPE payment_method AS ENUM ('COD');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COLLECTED', 'REFUNDED');
CREATE TYPE inventory_reason AS ENUM ('ORDER', 'CANCEL', 'RETURN', 'RESTOCK', 'ADJUST');
CREATE TYPE product_event_type AS ENUM ('PUBLISH', 'SOLD_OUT', 'ARCHIVE', 'REACTIVATE', 'PRICE_FIX');

CREATE TABLE orders (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- DRK- + 6 random characters without 0, O, 1 and I (easy to read aloud).
    order_number        TEXT           NOT NULL UNIQUE
                        CHECK (order_number ~ '^DRK-[2-9A-HJ-NP-Z]{6}$'),
    -- SHA-256 of the secret track token. The raw token is shown only once.
    track_token_hash    BYTEA          NOT NULL UNIQUE,

    -- Buyer (from the checkout form)
    name                TEXT           NOT NULL,
    phone               TEXT           NOT NULL CHECK (phone ~ '^01[3-9][0-9]{8}$'),
    email               TEXT, -- empty (NULL) = not given

    -- Where to deliver. delivery_area_id is the row the charge came from;
    -- the texts are copies, so the order still reads right if areas change.
    delivery_area_id    BIGINT         NOT NULL REFERENCES delivery_areas (id),
    district            TEXT           NOT NULL,
    district_area       TEXT, -- "Dhaka city" / "Outside Dhaka city"; NULL elsewhere
    area                TEXT           NOT NULL, -- area or thana: "Mirpur 10"
    address             TEXT           NOT NULL,
    courier_note        TEXT           NOT NULL DEFAULT '',

    -- Gift
    is_gift             BOOLEAN        NOT NULL DEFAULT false,
    gift_receiver_name  TEXT,
    gift_receiver_phone TEXT CHECK (gift_receiver_phone ~ '^01[3-9][0-9]{8}$'),
    gift_note           TEXT           NOT NULL DEFAULT '',
    gift_hide_prices    BOOLEAN        NOT NULL DEFAULT false,

    -- Money snapshots, copied when the order is placed (paisa).
    zone_code           TEXT           NOT NULL,
    delivery_paisa      BIGINT         NOT NULL CHECK (delivery_paisa >= 0),
    subtotal_paisa      BIGINT         NOT NULL CHECK (subtotal_paisa > 0),
    total_paisa         BIGINT         NOT NULL,
    currency            TEXT           NOT NULL DEFAULT 'BDT',
    payment_method      payment_method NOT NULL DEFAULT 'COD',

    status              order_status   NOT NULL DEFAULT 'PENDING',
    courier_name        TEXT,
    courier_tracking    TEXT,

    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    confirmed_at        TIMESTAMPTZ,
    shipped_at          TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       TEXT,

    CHECK (total_paisa = subtotal_paisa + delivery_paisa),
    -- A gift needs the receiver's name and phone.
    CHECK (NOT is_gift OR (gift_receiver_name IS NOT NULL AND gift_receiver_phone IS NOT NULL)),
    -- A cancelled order always says when and why.
    CHECK (status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))
);

-- Purchase limit and tracking look orders up by phone.
CREATE INDEX orders_phone_idx ON orders (phone);
-- The auto-cancel sweep looks for old PENDING orders.
CREATE INDEX orders_status_created_at_idx ON orders (status, created_at);

CREATE TABLE order_items (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id         BIGINT  NOT NULL REFERENCES orders (id),
    variant_id       BIGINT  NOT NULL REFERENCES product_variants (id),
    product_id       BIGINT  NOT NULL REFERENCES products (id),
    -- Snapshots: what the buyer saw when ordering, even if it changes later.
    product_name     TEXT    NOT NULL,
    variant_label    TEXT    NOT NULL,
    unit_price_paisa BIGINT  NOT NULL CHECK (unit_price_paisa > 0),
    qty              INTEGER NOT NULL CHECK (qty > 0),
    line_total_paisa BIGINT  NOT NULL,
    currency         TEXT    NOT NULL DEFAULT 'BDT',
    CHECK (line_total_paisa = unit_price_paisa * qty)
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);
CREATE INDEX order_items_product_id_idx ON order_items (product_id);

-- Every status change, for the tracking timeline.
CREATE TABLE order_status_history (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id    BIGINT       NOT NULL REFERENCES orders (id),
    from_status order_status, -- NULL for the first row (order placed)
    to_status   order_status NOT NULL,
    actor       actor_type   NOT NULL,
    note        TEXT         NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX order_status_history_order_id_idx ON order_status_history (order_id);

CREATE TABLE payments (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id     BIGINT         NOT NULL REFERENCES orders (id),
    method       payment_method NOT NULL,
    amount_paisa BIGINT         NOT NULL CHECK (amount_paisa >= 0),
    currency     TEXT           NOT NULL DEFAULT 'BDT',
    status       payment_status NOT NULL DEFAULT 'PENDING',
    collected_at TIMESTAMPTZ,
    ref          TEXT,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX payments_order_id_idx ON payments (order_id);

-- Phone numbers that keep refusing COD orders. The admin adds them.
CREATE TABLE blocked_phones (
    phone      TEXT        PRIMARY KEY CHECK (phone ~ '^01[3-9][0-9]{8}$'),
    reason     TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The stock book: every change to a variant's stock and why.
CREATE TABLE inventory_movements (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    variant_id BIGINT           NOT NULL REFERENCES product_variants (id),
    change     INTEGER          NOT NULL CHECK (change <> 0), -- -2 sold, +2 back
    reason     inventory_reason NOT NULL,
    order_id   BIGINT           REFERENCES orders (id),
    note       TEXT             NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX inventory_movements_variant_id_idx ON inventory_movements (variant_id);
CREATE INDEX inventory_movements_order_id_idx ON inventory_movements (order_id);

-- Lifecycle changes of a product (SOLD_OUT, ARCHIVE, REACTIVATE ...).
-- by_admin_id has no foreign key yet: the admins table comes with admin login.
CREATE TABLE product_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  BIGINT             NOT NULL REFERENCES products (id),
    type        product_event_type NOT NULL,
    actor       actor_type         NOT NULL,
    reason      TEXT               NOT NULL DEFAULT '',
    old_value   TEXT,
    new_value   TEXT,
    by_admin_id BIGINT,
    created_at  TIMESTAMPTZ        NOT NULL DEFAULT now()
);

CREATE INDEX product_events_product_id_idx ON product_events (product_id);

-- +goose Down
DROP TABLE product_events;
DROP TABLE inventory_movements;
DROP TABLE blocked_phones;
DROP TABLE payments;
DROP TABLE order_status_history;
DROP TABLE order_items;
DROP TABLE orders;
DROP TYPE product_event_type;
DROP TYPE inventory_reason;
DROP TYPE payment_status;
DROP TYPE payment_method;
DROP TYPE actor_type;
DROP TYPE order_status;
