-- Admin accounts and login sessions (docs/blueprint.md, part 2 rule 8 and part 5).
-- MVP: one OWNER account. The role column is ready for a Staff role later.
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up

CREATE TYPE admin_role AS ENUM ('OWNER');

CREATE TABLE admins (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Stored in lower case, so "Me@X.com" and "me@x.com" are the same account.
    email           TEXT        NOT NULL UNIQUE CHECK (email = lower(email)),
    -- bcrypt hash ("$2a$12$..."). The password itself is never stored.
    password_hash   TEXT        NOT NULL,
    role            admin_role  NOT NULL DEFAULT 'OWNER',
    -- Wrong passwords in a row. Reaching login_max_failures (settings) locks
    -- the account until locked_until; a correct login sets it back to 0.
    failed_attempts INTEGER     NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blueprint rule 8: exactly one Owner. The database refuses a second one.
CREATE UNIQUE INDEX admins_one_owner_idx ON admins (role) WHERE role = 'OWNER';

-- One row per logged-in browser. The browser keeps a random secret in an
-- HttpOnly cookie; here we keep only its SHA-256 hash, so someone who reads
-- this table still cannot log in.
CREATE TABLE admin_sessions (
    id_hash      BYTEA       PRIMARY KEY,
    admin_id     BIGINT      NOT NULL REFERENCES admins (id),
    created_at   TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL, -- idle for 12 hours = logged out
    expires_at   TIMESTAMPTZ NOT NULL  -- at most 7 days after login
);

CREATE INDEX admin_sessions_admin_id_idx ON admin_sessions (admin_id);

-- Who did it: every admin change keeps the admin's id.
ALTER TABLE product_events
    ADD CONSTRAINT product_events_by_admin_id_fkey FOREIGN KEY (by_admin_id) REFERENCES admins (id);

ALTER TABLE order_status_history ADD COLUMN by_admin_id BIGINT REFERENCES admins (id);
ALTER TABLE order_status_history
    ADD CONSTRAINT order_status_history_admin_check CHECK (actor <> 'ADMIN' OR by_admin_id IS NOT NULL);

ALTER TABLE inventory_movements ADD COLUMN by_admin_id BIGINT REFERENCES admins (id);

-- Lockout numbers (part 2 rule 8: "temporary lockout after repeated wrong passwords").
INSERT INTO settings (key, value, description) VALUES
    ('login_max_failures',    '5',  'Wrong admin passwords in a row before login pauses'),
    ('login_lockout_minutes', '15', 'Minutes the admin login stays paused after too many wrong passwords');

-- +goose Down
DELETE FROM settings WHERE key IN ('login_max_failures', 'login_lockout_minutes');
ALTER TABLE inventory_movements DROP COLUMN by_admin_id;
ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_admin_check;
ALTER TABLE order_status_history DROP COLUMN by_admin_id;
ALTER TABLE product_events DROP CONSTRAINT product_events_by_admin_id_fkey;
DROP TABLE admin_sessions;
DROP TABLE admins;
DROP TYPE admin_role;
