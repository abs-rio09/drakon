-- Per-IP rate limits (open questions 4 and 14, decided 2026-10-25).
-- How many tries one visitor (one IP address) may make in a time window,
-- for admin login, place order, track and customer cancel. The numbers
-- live here, not in code (CLAUDE.md hard rule 3); the Owner changes them
-- in Admin > Settings.
-- Login: 4 tries per 15 minutes, below the 5 wrong passwords that pause
-- the account, so one stranger alone cannot finish a lockout in one window.
-- The shop limits are generous, because many phones in Bangladesh share one
-- mobile-network IP address.
-- Never edit this file after it has been applied. Make a new migration instead.

-- +goose Up
INSERT INTO settings (key, value, description) VALUES
    ('rate_login_tries',    '4',  'Admin login tries per IP address in one window'),
    ('rate_login_minutes',  '15', 'Length of the admin login window, in minutes'),
    ('rate_order_tries',    '30', 'Orders placed per IP address in one window'),
    ('rate_order_minutes',  '10', 'Length of the place-order window, in minutes'),
    ('rate_track_tries',    '30', 'Order lookups (track) per IP address in one window'),
    ('rate_track_minutes',  '10', 'Length of the track window, in minutes'),
    ('rate_cancel_tries',   '10', 'Customer cancel tries per IP address in one window'),
    ('rate_cancel_minutes', '10', 'Length of the customer cancel window, in minutes');

-- +goose Down
DELETE FROM settings WHERE key IN (
    'rate_login_tries', 'rate_login_minutes', 'rate_order_tries', 'rate_order_minutes',
    'rate_track_tries', 'rate_track_minutes', 'rate_cancel_tries', 'rate_cancel_minutes');
