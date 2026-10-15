-- Catalog tables (docs/blueprint.md, part 5).
-- Rules: money is integer paisa (BIGINT), never float. Products are never
-- deleted, so foreign keys have no ON DELETE CASCADE: the database refuses to
-- delete a row that other rows still point to.
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up

-- A product's place in its lifecycle: DRAFT -> ACTIVE <-> SOLD_OUT -> ARCHIVED.
CREATE TYPE product_status AS ENUM ('DRAFT', 'ACTIVE', 'SOLD_OUT', 'ARCHIVED');

CREATE TABLE categories (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug       TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL, -- plural, for menus: "Playcards"
    image_url  TEXT    NOT NULL DEFAULT '', -- collection tile photo (4:5)
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE products (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id    BIGINT         NOT NULL REFERENCES categories (id),
    slug           TEXT           NOT NULL UNIQUE,
    name           TEXT           NOT NULL,
    kind           TEXT           NOT NULL, -- what it is, singular: "Tech toy"
    variant_kind   TEXT           NOT NULL DEFAULT 'Edition', -- the choice: "Size", "Material"
    summary        TEXT           NOT NULL DEFAULT '',
    -- The story is a list of paragraphs, shown one after another.
    story          TEXT[]         NOT NULL DEFAULT '{}',
    status         product_status NOT NULL DEFAULT 'DRAFT',
    is_limited     BOOLEAN        NOT NULL DEFAULT false,
    -- Only when a run has a known size, e.g. 100. Empty (NULL) = not shown.
    edition_size   INTEGER        CHECK (edition_size > 0),
    -- Empty (NULL) = use default_purchase_limit from the settings table.
    purchase_limit INTEGER        CHECK (purchase_limit > 0),
    -- A newer edition that is on sale now (shown in the sold-out archive).
    successor_id   BIGINT         REFERENCES products (id),
    -- Position in the home page's "current drop". Empty (NULL) = not featured.
    featured_order INTEGER        UNIQUE CHECK (featured_order > 0),
    sold_out_at    TIMESTAMPTZ,
    archived_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CHECK (successor_id <> id)
);

CREATE INDEX products_category_id_idx ON products (category_id);
CREATE INDEX products_status_idx ON products (status);

-- "Details" table on the product page: term / text pairs, in order.
CREATE TABLE product_details (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT  NOT NULL REFERENCES products (id),
    term       TEXT    NOT NULL, -- "Size"
    text       TEXT    NOT NULL, -- "Card 63 × 88 mm"
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX product_details_product_id_idx ON product_details (product_id);

CREATE TABLE product_images (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT  NOT NULL REFERENCES products (id),
    url        TEXT    NOT NULL, -- full photo, 1:1
    thumb_url  TEXT    NOT NULL, -- small square crop
    short_name TEXT    NOT NULL DEFAULT '', -- thumbnail button name: "Back"
    alt        TEXT    NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX product_images_product_id_idx ON product_images (product_id);

CREATE TABLE product_variants (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id  BIGINT  NOT NULL REFERENCES products (id),
    sku         TEXT    NOT NULL UNIQUE,
    label       TEXT    NOT NULL, -- "M", "Metal", "Standard"
    note        TEXT    NOT NULL DEFAULT '', -- one line under the label
    price_paisa BIGINT  NOT NULL CHECK (price_paisa > 0),
    currency    TEXT    NOT NULL DEFAULT 'BDT',
    -- The database itself refuses any change that would make stock negative,
    -- so two buyers can never both get the last item.
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    -- Which product photo shows this variant (0 = first, by sort_order).
    -- Empty (NULL) = no special photo.
    image_index INTEGER CHECK (image_index >= 0),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX product_variants_product_id_idx ON product_variants (product_id);

-- +goose Down
-- Reverse order: a table must be dropped before the table it points to.
DROP TABLE product_variants;
DROP TABLE product_images;
DROP TABLE product_details;
DROP TABLE products;
DROP TABLE categories;
DROP TYPE product_status;
