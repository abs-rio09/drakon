-- Settings and delivery tables (docs/blueprint.md, part 5).
-- Business numbers (60/100 taka, 48 hours, limit 5, 3 days, 7 days) live in
-- these tables, never in code. The admin panel will edit them later.
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up

-- One row per setting. value is JSONB, so it can hold a number, true/false
-- or text: 48, false, "dragon-flame-playcard-set".
CREATE TABLE settings (
    key         TEXT        PRIMARY KEY,
    value       JSONB       NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value, description) VALUES
    ('cod_confirm_hours',       '48',    'Hours to confirm a Cash on Delivery order by phone before it is cancelled'),
    ('default_purchase_limit',  '5',     'Most pieces of one product per phone number, when the product has no own limit'),
    ('return_days',             '3',     'Days after delivery to ask for a return'),
    ('archive_after_days',      '7',     'Days after SOLD_OUT before a product moves to ARCHIVED'),
    ('free_delivery_enabled',   'false', 'Turns the free_over_paisa rule of delivery zones on or off'),
    ('low_stock_threshold',     '5',     '"Only 3 left" wording starts at this stock or below'),
    ('gift_note_max_chars',     '150',   'Longest gift note'),
    ('courier_note_max_chars',  '200',   'Longest courier note'),
    ('home_hero_product_slug',  '"dragon-flame-playcard-set"', 'Product under the gallery label of the home page hero');

CREATE TABLE delivery_zones (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            TEXT    NOT NULL UNIQUE, -- INSIDE_DHAKA, OUTSIDE_DHAKA
    name            TEXT    NOT NULL,        -- "Inside Dhaka"
    charge_paisa    BIGINT  NOT NULL CHECK (charge_paisa >= 0),
    -- Free delivery when the subtotal is at least this much AND the setting
    -- free_delivery_enabled is true. Empty (NULL) = never free.
    free_over_paisa BIGINT  CHECK (free_over_paisa > 0),
    currency        TEXT    NOT NULL DEFAULT 'BDT',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO delivery_zones (code, name, charge_paisa, sort_order) VALUES
    ('INSIDE_DHAKA',  'Inside Dhaka',  6000,  1),
    ('OUTSIDE_DHAKA', 'Outside Dhaka', 10000, 2);

-- Where the buyer lives -> which zone. Most districts have one row (the
-- label is the district name). Dhaka has two: "Dhaka city" and
-- "Outside Dhaka city", so the buyer must choose one.
CREATE TABLE delivery_areas (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district   TEXT    NOT NULL,
    area_label TEXT    NOT NULL,
    hint       TEXT    NOT NULL DEFAULT '', -- "Savar, Keraniganj and others"
    zone_id    BIGINT  NOT NULL REFERENCES delivery_zones (id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (district, area_label)
);

CREATE INDEX delivery_areas_zone_id_idx ON delivery_areas (zone_id);

-- All 64 districts of Bangladesh, A to Z (same list as the website).
INSERT INTO delivery_areas (district, area_label, hint, zone_id, sort_order)
SELECT a.district, a.area_label, a.hint, z.id, a.sort_order
FROM (VALUES
    ('Bagerhat', 'Bagerhat', '', 'OUTSIDE_DHAKA', 0),
    ('Bandarban', 'Bandarban', '', 'OUTSIDE_DHAKA', 10),
    ('Barguna', 'Barguna', '', 'OUTSIDE_DHAKA', 20),
    ('Barishal', 'Barishal', '', 'OUTSIDE_DHAKA', 30),
    ('Bhola', 'Bhola', '', 'OUTSIDE_DHAKA', 40),
    ('Bogura', 'Bogura', '', 'OUTSIDE_DHAKA', 50),
    ('Brahmanbaria', 'Brahmanbaria', '', 'OUTSIDE_DHAKA', 60),
    ('Chandpur', 'Chandpur', '', 'OUTSIDE_DHAKA', 70),
    ('Chapai Nawabganj', 'Chapai Nawabganj', '', 'OUTSIDE_DHAKA', 80),
    ('Chattogram', 'Chattogram', '', 'OUTSIDE_DHAKA', 90),
    ('Chuadanga', 'Chuadanga', '', 'OUTSIDE_DHAKA', 100),
    ('Cox''s Bazar', 'Cox''s Bazar', '', 'OUTSIDE_DHAKA', 110),
    ('Cumilla', 'Cumilla', '', 'OUTSIDE_DHAKA', 120),
    ('Dhaka', 'Dhaka city', 'Inside Dhaka zone', 'INSIDE_DHAKA', 131),
    ('Dhaka', 'Outside Dhaka city', 'Savar, Keraniganj and others', 'OUTSIDE_DHAKA', 132),
    ('Dinajpur', 'Dinajpur', '', 'OUTSIDE_DHAKA', 140),
    ('Faridpur', 'Faridpur', '', 'OUTSIDE_DHAKA', 150),
    ('Feni', 'Feni', '', 'OUTSIDE_DHAKA', 160),
    ('Gaibandha', 'Gaibandha', '', 'OUTSIDE_DHAKA', 170),
    ('Gazipur', 'Gazipur', '', 'OUTSIDE_DHAKA', 180),
    ('Gopalganj', 'Gopalganj', '', 'OUTSIDE_DHAKA', 190),
    ('Habiganj', 'Habiganj', '', 'OUTSIDE_DHAKA', 200),
    ('Jamalpur', 'Jamalpur', '', 'OUTSIDE_DHAKA', 210),
    ('Jashore', 'Jashore', '', 'OUTSIDE_DHAKA', 220),
    ('Jhalokati', 'Jhalokati', '', 'OUTSIDE_DHAKA', 230),
    ('Jhenaidah', 'Jhenaidah', '', 'OUTSIDE_DHAKA', 240),
    ('Joypurhat', 'Joypurhat', '', 'OUTSIDE_DHAKA', 250),
    ('Khagrachhari', 'Khagrachhari', '', 'OUTSIDE_DHAKA', 260),
    ('Khulna', 'Khulna', '', 'OUTSIDE_DHAKA', 270),
    ('Kishoreganj', 'Kishoreganj', '', 'OUTSIDE_DHAKA', 280),
    ('Kurigram', 'Kurigram', '', 'OUTSIDE_DHAKA', 290),
    ('Kushtia', 'Kushtia', '', 'OUTSIDE_DHAKA', 300),
    ('Lakshmipur', 'Lakshmipur', '', 'OUTSIDE_DHAKA', 310),
    ('Lalmonirhat', 'Lalmonirhat', '', 'OUTSIDE_DHAKA', 320),
    ('Madaripur', 'Madaripur', '', 'OUTSIDE_DHAKA', 330),
    ('Magura', 'Magura', '', 'OUTSIDE_DHAKA', 340),
    ('Manikganj', 'Manikganj', '', 'OUTSIDE_DHAKA', 350),
    ('Meherpur', 'Meherpur', '', 'OUTSIDE_DHAKA', 360),
    ('Moulvibazar', 'Moulvibazar', '', 'OUTSIDE_DHAKA', 370),
    ('Munshiganj', 'Munshiganj', '', 'OUTSIDE_DHAKA', 380),
    ('Mymensingh', 'Mymensingh', '', 'OUTSIDE_DHAKA', 390),
    ('Naogaon', 'Naogaon', '', 'OUTSIDE_DHAKA', 400),
    ('Narail', 'Narail', '', 'OUTSIDE_DHAKA', 410),
    ('Narayanganj', 'Narayanganj', '', 'OUTSIDE_DHAKA', 420),
    ('Narsingdi', 'Narsingdi', '', 'OUTSIDE_DHAKA', 430),
    ('Natore', 'Natore', '', 'OUTSIDE_DHAKA', 440),
    ('Netrokona', 'Netrokona', '', 'OUTSIDE_DHAKA', 450),
    ('Nilphamari', 'Nilphamari', '', 'OUTSIDE_DHAKA', 460),
    ('Noakhali', 'Noakhali', '', 'OUTSIDE_DHAKA', 470),
    ('Pabna', 'Pabna', '', 'OUTSIDE_DHAKA', 480),
    ('Panchagarh', 'Panchagarh', '', 'OUTSIDE_DHAKA', 490),
    ('Patuakhali', 'Patuakhali', '', 'OUTSIDE_DHAKA', 500),
    ('Pirojpur', 'Pirojpur', '', 'OUTSIDE_DHAKA', 510),
    ('Rajbari', 'Rajbari', '', 'OUTSIDE_DHAKA', 520),
    ('Rajshahi', 'Rajshahi', '', 'OUTSIDE_DHAKA', 530),
    ('Rangamati', 'Rangamati', '', 'OUTSIDE_DHAKA', 540),
    ('Rangpur', 'Rangpur', '', 'OUTSIDE_DHAKA', 550),
    ('Satkhira', 'Satkhira', '', 'OUTSIDE_DHAKA', 560),
    ('Shariatpur', 'Shariatpur', '', 'OUTSIDE_DHAKA', 570),
    ('Sherpur', 'Sherpur', '', 'OUTSIDE_DHAKA', 580),
    ('Sirajganj', 'Sirajganj', '', 'OUTSIDE_DHAKA', 590),
    ('Sunamganj', 'Sunamganj', '', 'OUTSIDE_DHAKA', 600),
    ('Sylhet', 'Sylhet', '', 'OUTSIDE_DHAKA', 610),
    ('Tangail', 'Tangail', '', 'OUTSIDE_DHAKA', 620),
    ('Thakurgaon', 'Thakurgaon', '', 'OUTSIDE_DHAKA', 630)
) AS a (district, area_label, hint, zone_code, sort_order)
JOIN delivery_zones z ON z.code = a.zone_code;

-- +goose Down
DROP TABLE delivery_areas;
DROP TABLE delivery_zones;
DROP TABLE settings;
