-- Development seed data: the same catalogue as the old web/src/mocks/catalog.ts,
-- so the site looks exactly the same when it reads from the database.
-- NOT a migration: production starts empty and the admin adds real products.
-- Safe to run twice: every insert skips rows that already exist
-- (ON CONFLICT DO NOTHING / NOT EXISTS). It never changes or deletes a row,
-- so stock that orders already used is left alone.
-- Run it with: make seed   (from api/)

BEGIN;

-- Categories
INSERT INTO categories (slug, name, image_url, sort_order) VALUES
    ('playcards', 'Playcards', '/img/cat-playcard.webp', 1),
    ('sports-toys', 'Sports toys', '/img/cat-sports.webp', 2),
    ('tech-toys', 'Tech toys', '/img/cat-tech.webp', 3),
    ('clothes', 'Clothes', '/img/cat-clothes.webp', 4)
ON CONFLICT (slug) DO NOTHING;

-- Dragon Flame Card · Edition 01
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'dragon-flame-card-edition-01', 'Dragon Flame Card · Edition 01', 'Collectible card', 'Material',
       'The first DRAKON card, for the people who stay awake at night. Every card is numbered from 1 to 100. Choose the material you want to hold.',
       ARRAY['Drakon comes from "dark". This card is a small gift for the people who stay awake when the night gets deep: night workers, gamers, coders, dream chasers.', '[Add the story of the Dragon Flame artwork and the designer who made it.]'],
       'ACTIVE', true, 100, 2, 1, NULL, NULL
FROM categories c WHERE c.slug = 'playcards'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_details (product_id, term, text, sort_order)
SELECT p.id, d.term, d.text, d.sort_order
FROM products p, (VALUES
    ('Size', 'Card 63 × 88 mm, the standard playing card size. Key-ring [size in mm]', 0),
    ('Hard paper', '[Paper weight and finish]', 1),
    ('Plastic', '[Plastic type and thickness]', 2),
    ('Metal', '[Metal type, thickness and etching]', 3),
    ('Edition', '100 pieces across all materials, each card numbered', 4)
) AS d (term, text, sort_order)
WHERE p.slug = 'dragon-flame-card-edition-01'
  AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = p.id);

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/c-df-lineup.webp', '/img/t-c-df-lineup.webp', 'All materials', 'Dragon Flame card in hard paper, plastic and metal, with two key-rings', 0),
    ('/img/c-df-paper.webp', '/img/t-c-df-paper.webp', 'Hard paper', 'Hard paper Dragon Flame card with its back', 1),
    ('/img/c-df-plastic.webp', '/img/t-c-df-plastic.webp', 'Plastic', 'Plastic Dragon Flame card with its back', 2),
    ('/img/c-df-metal.webp', '/img/t-c-df-metal.webp', 'Metal', 'Brushed metal Dragon Flame card with etched art', 3),
    ('/img/c-df-keyring.webp', '/img/t-c-df-keyring.webp', 'Key-rings', 'Plastic and metal Dragon Flame key-rings', 4)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'dragon-flame-card-edition-01'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('DF01-PAPER', 'Hard paper', 'Thick matte card stock', 45000, 22, 1, 0),
    ('DF01-PLASTIC', 'Plastic', 'Smooth, waterproof', 69000, 9, 2, 1),
    ('DF01-METAL', 'Metal', 'Brushed steel, etched art', 149000, 3, 3, 2),
    ('DF01-PKEY', 'Plastic key-ring', 'Mini card with a steel ring', 59000, 0, 4, 3),
    ('DF01-MKEY', 'Metal key-ring', 'Mini steel card with a ring', 129000, 4, 4, 4)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'dragon-flame-card-edition-01'
ON CONFLICT (sku) DO NOTHING;

-- Ember Night Hoodie · Edition 02
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'ember-night-hoodie-edition-02', 'Ember Night Hoodie · Edition 02', 'Clothes', 'Size',
       'A heavyweight black hoodie with the Drakon ember mark. Made in one numbered run. When it sells out, it moves to the archive for good.',
       ARRAY['Edition 02 follows the sold-out Edition 01. Same cut, a new ember print on the back, and a woven edition tag inside the collar.', '[Add the story of this drop: what inspired it and who it is for.]'],
       'ACTIVE', true, NULL, 2, 2, NULL, NULL
FROM categories c WHERE c.slug = 'clothes'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_details (product_id, term, text, sort_order)
SELECT p.id, d.term, d.text, d.sort_order
FROM products p, (VALUES
    ('Material', '[Fabric and weight, e.g. cotton fleece, GSM]', 0),
    ('Fit', '[Regular / oversized]', 1),
    ('Sizes', 'S, M, L, XL. [Chest and length per size, in cm]', 2),
    ('Care', '[Washing instructions]', 3),
    ('Edition', 'Edition 02 of a run of [number of pieces made]', 4)
) AS d (term, text, sort_order)
WHERE p.slug = 'ember-night-hoodie-edition-02'
  AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = p.id);

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/p-hoodie02-front.webp', '/img/t-p-hoodie02-front.webp', 'Front', 'Ember Night Hoodie Edition 02, folded, front with the small ember mark', 0),
    ('/img/p-hoodie02-back.webp', '/img/p-hoodie02-back.webp', 'Back', 'Back of the hoodie with the large ember eye print and Edition 02', 1),
    ('/img/p-hoodie02-detail.webp', '/img/p-hoodie02-detail.webp', 'Detail', 'Close-up of the screen print and drawstring', 2),
    ('/img/p-hoodie02-tag.webp', '/img/p-hoodie02-tag.webp', 'Tag', 'Woven Edition 02 label inside the collar', 3)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'ember-night-hoodie-edition-02'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('HD02-S', 'S', '', 245000, 3, NULL::integer, 0),
    ('HD02-M', 'M', '', 245000, 4, NULL::integer, 1),
    ('HD02-L', 'L', '', 245000, 0, NULL::integer, 2),
    ('HD02-XL', 'XL', '', 245000, 6, NULL::integer, 3)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'ember-night-hoodie-edition-02'
ON CONFLICT (sku) DO NOTHING;

-- Midnight Circuit Desk Drone
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'midnight-circuit-desk-drone', 'Midnight Circuit Desk Drone', 'Tech toy', 'Model',
       'A small black desk drone with four guarded rotors and an ember light strip. Made in one run.',
       ARRAY['[Add the story of the drone: flight time, charging, who it is for.]'],
       'ACTIVE', true, NULL, NULL, 3, NULL, NULL
FROM categories c WHERE c.slug = 'tech-toys'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_details (product_id, term, text, sort_order)
SELECT p.id, d.term, d.text, d.sort_order
FROM products p, (VALUES
    ('Size', '[Width × depth × height in mm]', 0),
    ('Battery', '[Flight time and charging time]', 1),
    ('In the box', '[Drone, charging cable, spare rotors]', 2)
) AS d (term, text, sort_order)
WHERE p.slug = 'midnight-circuit-desk-drone'
  AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = p.id);

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/p-desk-drone.webp', '/img/t-p-desk-drone.webp', 'Front', 'Black desk drone with four guarded rotors and an ember light strip', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'midnight-circuit-desk-drone'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('DRN-01', 'Standard', '', 340000, 3, NULL::integer, 0)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'midnight-circuit-desk-drone'
ON CONFLICT (sku) DO NOTHING;

-- Night Striker Football
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'night-striker-football', 'Night Striker Football', 'Sports toy', 'Size',
       'A matte black football with muted ember pentagons. Made for night games under street lights.',
       ARRAY['[Add the story of the ball: material, where it plays best.]'],
       'ACTIVE', false, NULL, NULL, 4, NULL, NULL
FROM categories c WHERE c.slug = 'sports-toys'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_details (product_id, term, text, sort_order)
SELECT p.id, d.term, d.text, d.sort_order
FROM products p, (VALUES
    ('Size', 'Size 5, match size', 0),
    ('Material', '[Cover material and bladder]', 1)
) AS d (term, text, sort_order)
WHERE p.slug = 'night-striker-football'
  AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = p.id);

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/p-striker-football.webp', '/img/t-p-striker-football.webp', 'Front', 'Matte black football with muted ember pentagons on dark slate', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'night-striker-football'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('BALL-5', 'Size 5', '', 180000, 20, NULL::integer, 0)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'night-striker-football'
ON CONFLICT (sku) DO NOTHING;

-- Dragon Flame Playcard Set
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'dragon-flame-playcard-set', 'Dragon Flame Playcard Set', 'Playcard set', 'Edition',
       'A full playcard set with the Dragon Flame art, in its own box. Made in one run.',
       ARRAY['[Add the story of the set: how many cards, what game it plays.]'],
       'ACTIVE', true, NULL, 5, NULL, NULL, NULL
FROM categories c WHERE c.slug = 'playcards'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_details (product_id, term, text, sort_order)
SELECT p.id, d.term, d.text, d.sort_order
FROM products p, (VALUES
    ('In the box', '[Number of cards and extras]', 0),
    ('Card size', '63 × 88 mm', 1)
) AS d (term, text, sort_order)
WHERE p.slug = 'dragon-flame-playcard-set'
  AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = p.id);

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/p-dragon-flame-set.webp', '/img/t-p-dragon-flame-set.webp', 'Set', 'Dragon Flame playcards fanned beside their box', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'dragon-flame-playcard-set'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('DFSET-STD', 'Standard', '', 125000, 12, NULL::integer, 0)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'dragon-flame-playcard-set'
ON CONFLICT (sku) DO NOTHING;

-- Card Sleeves · Ember 100
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'card-sleeves-ember-100', 'Card Sleeves · Ember 100', 'Playcard sleeves', 'Pack',
       'A box of 100 matte card sleeves with a thin ember edge. Fits standard 63 × 88 mm cards.',
       ARRAY['[Add details about the sleeves.]'],
       'ACTIVE', false, NULL, NULL, NULL, NULL, NULL
FROM categories c WHERE c.slug = 'playcards'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_details (product_id, term, text, sort_order)
SELECT p.id, d.term, d.text, d.sort_order
FROM products p, (VALUES
    ('In the box', '100 sleeves', 0)
) AS d (term, text, sort_order)
WHERE p.slug = 'card-sleeves-ember-100'
  AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = p.id);

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/p-card-sleeves.webp', '/img/t-p-card-sleeves.webp', 'Box', 'Box of ember card sleeves with two sleeved cards', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'card-sleeves-ember-100'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('SLV-100', 'Box of 100', '', 35000, 48, NULL::integer, 0)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'card-sleeves-ember-100'
ON CONFLICT (sku) DO NOTHING;

-- Ember Logo Tee · Black
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'ember-logo-tee-black', 'Ember Logo Tee · Black', 'Clothes', 'Size',
       'A black cotton tee with a small ember D on the chest. Restocks.',
       ARRAY['[Add details about the tee.]'],
       'ACTIVE', false, NULL, NULL, NULL, NULL, NULL
FROM categories c WHERE c.slug = 'clothes'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_details (product_id, term, text, sort_order)
SELECT p.id, d.term, d.text, d.sort_order
FROM products p, (VALUES
    ('Material', '[Fabric and weight]', 0),
    ('Sizes', 'S, M, L, XL', 1)
) AS d (term, text, sort_order)
WHERE p.slug = 'ember-logo-tee-black'
  AND NOT EXISTS (SELECT 1 FROM product_details x WHERE x.product_id = p.id);

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/p-logo-tee.webp', '/img/t-p-logo-tee.webp', 'Front', 'Folded black tee with a small ember D logo', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'ember-logo-tee-black'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('TEE-S', 'S', '', 99000, 0, NULL::integer, 0),
    ('TEE-M', 'M', '', 99000, 0, NULL::integer, 1),
    ('TEE-L', 'L', '', 99000, 0, NULL::integer, 2),
    ('TEE-XL', 'XL', '', 99000, 0, NULL::integer, 3)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'ember-logo-tee-black'
ON CONFLICT (sku) DO NOTHING;

-- Ember Night Hoodie · Edition 01
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'ember-night-hoodie-edition-01', 'Ember Night Hoodie · Edition 01', 'Clothes', 'Size',
       'The first ember print. Edition 02 keeps the cut and adds a new back print and a woven edition tag.',
       '{}'::text[],
       'ARCHIVED', true, NULL, 2, NULL, '2026-10-08T12:00:00+06:00', '2026-10-08T12:00:00+06:00'
FROM categories c WHERE c.slug = 'clothes'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/so-hoodie01.webp', '/img/t-so-hoodie01.webp', 'Back', 'Folded black hoodie, Edition 01, back print', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'ember-night-hoodie-edition-01'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('HD01-M', 'M', '', 210000, 0, NULL::integer, 0)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'ember-night-hoodie-edition-01'
ON CONFLICT (sku) DO NOTHING;

-- Founders Playcard Deck
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'founders-playcard-deck', 'Founders Playcard Deck', 'Playcard deck', 'Edition',
       'The founders deck.',
       '{}'::text[],
       'SOLD_OUT', true, NULL, NULL, NULL, '2026-09-21T12:00:00+06:00', NULL
FROM categories c WHERE c.slug = 'playcards'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/so-founders-deck.webp', '/img/t-so-founders-deck.webp', 'Deck', 'Founders playcard deck and box', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'founders-playcard-deck'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('FND-STD', 'Standard', '', 150000, 0, NULL::integer, 0)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'founders-playcard-deck'
ON CONFLICT (sku) DO NOTHING;

-- Glow Arena Mini Goal
INSERT INTO products (category_id, slug, name, kind, variant_kind, summary, story, status, is_limited,
                      edition_size, purchase_limit, featured_order, sold_out_at, archived_at)
SELECT c.id, 'glow-arena-mini-goal', 'Glow Arena Mini Goal', 'Sports toy', 'Model',
       'A mini football goal with a glowing crossbar.',
       '{}'::text[],
       'SOLD_OUT', true, NULL, NULL, NULL, '2026-09-02T12:00:00+06:00', NULL
FROM categories c WHERE c.slug = 'sports-toys'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO product_images (product_id, url, thumb_url, short_name, alt, sort_order)
SELECT p.id, i.url, i.thumb_url, i.short_name, i.alt, i.sort_order
FROM products p, (VALUES
    ('/img/so-mini-goal.webp', '/img/t-so-mini-goal.webp', 'Goal', 'Mini football goal with a glowing crossbar', 0)
) AS i (url, thumb_url, short_name, alt, sort_order)
WHERE p.slug = 'glow-arena-mini-goal'
  AND NOT EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id);

INSERT INTO product_variants (product_id, sku, label, note, price_paisa, stock, image_index, sort_order)
SELECT p.id, v.sku, v.label, v.note, v.price_paisa, v.stock, v.image_index, v.sort_order
FROM products p, (VALUES
    ('GOAL-01', 'Standard', '', 260000, 0, NULL::integer, 0)
) AS v (sku, label, note, price_paisa, stock, image_index, sort_order)
WHERE p.slug = 'glow-arena-mini-goal'
ON CONFLICT (sku) DO NOTHING;

-- Newer editions (successor), set once both products exist.
UPDATE products SET successor_id = (SELECT id FROM products WHERE slug = 'ember-night-hoodie-edition-02')
WHERE slug = 'ember-night-hoodie-edition-01' AND successor_id IS NULL;

COMMIT;
