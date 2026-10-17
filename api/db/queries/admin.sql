-- Admin accounts and sessions.

-- name: GetAdminForLogin :one
-- FOR UPDATE: two login tries at the same moment take turns, so every
-- wrong password is counted.
SELECT id, email, password_hash, role, failed_attempts, locked_until
FROM admins
WHERE email = $1
FOR UPDATE;

-- name: RecordLoginFailure :exec
UPDATE admins
SET failed_attempts = sqlc.arg('failed_attempts'), locked_until = sqlc.narg('locked_until'), updated_at = sqlc.arg('at')
WHERE id = sqlc.arg('id');

-- name: RecordLoginSuccess :exec
UPDATE admins
SET failed_attempts = 0, locked_until = NULL, updated_at = sqlc.arg('at')
WHERE id = sqlc.arg('id');

-- name: InsertAdmin :one
INSERT INTO admins (email, password_hash, role, created_at, updated_at)
VALUES ($1, $2, $3, sqlc.arg('at'), sqlc.arg('at'))
RETURNING id;

-- name: OwnerExists :one
SELECT EXISTS (SELECT 1 FROM admins WHERE role = 'OWNER');

-- name: SetAdminPassword :one
-- A new password also ends the lockout.
UPDATE admins
SET password_hash = $2, failed_attempts = 0, locked_until = NULL, updated_at = sqlc.arg('at')
WHERE email = $1
RETURNING id;

-- name: InsertAdminSession :exec
INSERT INTO admin_sessions (id_hash, admin_id, created_at, last_seen_at, expires_at)
VALUES ($1, $2, sqlc.arg('at'), sqlc.arg('at'), sqlc.arg('expires_at'));

-- name: GetSessionAdmin :one
-- The admin behind a session, if the session is still alive: not past its
-- 7-day end, and used within the idle time (idle_cutoff = now - 12 hours).
SELECT a.id, a.email, a.role
FROM admin_sessions s
JOIN admins a ON a.id = s.admin_id
WHERE s.id_hash = $1 AND s.expires_at > sqlc.arg('now') AND s.last_seen_at > sqlc.arg('idle_cutoff');

-- name: TouchAdminSession :exec
UPDATE admin_sessions SET last_seen_at = sqlc.arg('at') WHERE id_hash = $1;

-- name: DeleteAdminSession :exec
DELETE FROM admin_sessions WHERE id_hash = $1;

-- name: DeleteAdminSessionsFor :exec
-- After a password change every logged-in browser must log in again.
DELETE FROM admin_sessions WHERE admin_id = $1;

-- name: DeleteDeadAdminSessions :execrows
-- Housekeeping for the sweep: sessions past their end or idle too long.
DELETE FROM admin_sessions
WHERE expires_at <= sqlc.arg('now') OR last_seen_at <= sqlc.arg('idle_cutoff');
