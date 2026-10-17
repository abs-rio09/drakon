// Package auth is the admin login: passwords (bcrypt), the lockout after
// repeated wrong passwords, and sessions (docs/blueprint.md, part 2 rule 8).
//
// How a session works, in short:
//  1. Login checks the password and makes a random secret (the token).
//  2. The browser gets the token in an HttpOnly cookie (JavaScript cannot
//     read it). The database keeps only the token's SHA-256 hash.
//  3. Every admin request sends the cookie; we hash it and look the hash up.
//  4. Logout deletes the row, so the token is worth nothing afterwards.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

const (
	// BcryptCost 12: one check takes about a quarter of a second. Nothing
	// for a person logging in, very slow for someone guessing millions.
	BcryptCost = 12

	// A session ends after 12 hours without use, and 7 days after login
	// at the latest, whatever happens.
	SessionIdle = 12 * time.Hour
	SessionMax  = 7 * 24 * time.Hour

	MinPasswordRunes = 12
	// bcrypt only reads the first 72 bytes; longer passwords are refused
	// instead of being cut quietly.
	MaxPasswordBytes = 72
	maxEmailRunes    = 254
)

// Admin is the logged-in person, as the handlers see it.
type Admin struct {
	ID    int64  `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

var (
	// ErrInvalidLogin is the ONE answer for a wrong email, a wrong password
	// and a paused (locked) account, so nobody can find out which emails
	// have an account.
	ErrInvalidLogin = errors.New("wrong email or password")
	// ErrNoSession: no cookie, an unknown token, or an expired session.
	ErrNoSession = errors.New("not logged in")
	// ErrOwnerExists: blueprint rule 8 allows only one Owner.
	ErrOwnerExists = errors.New("an owner account already exists")
	ErrEmailTaken  = errors.New("an admin with this email already exists")
	ErrNoSuchAdmin = errors.New("no admin with this email")
)

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

// NormalizeEmail trims and lower-cases: " Me@X.com " -> "me@x.com".
func NormalizeEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }

// CheckEmail returns a problem to show, or "" when the email looks fine.
func CheckEmail(email string) string {
	if utf8.RuneCountInString(email) > maxEmailRunes || !emailRe.MatchString(email) {
		return "Enter a valid email address."
	}
	return ""
}

// CheckNewPassword returns a problem to show, or "" when the password is
// strong enough to be saved.
func CheckNewPassword(password, email string) string {
	switch {
	case utf8.RuneCountInString(password) < MinPasswordRunes:
		return fmt.Sprintf("Use at least %d characters.", MinPasswordRunes)
	case len(password) > MaxPasswordBytes:
		return fmt.Sprintf("Use at most %d bytes (about %d letters).", MaxPasswordBytes, MaxPasswordBytes)
	case strings.TrimSpace(password) != password:
		return "Do not start or end the password with a space."
	case strings.EqualFold(password, email):
		return "The password must not be your email."
	}
	return ""
}

// HashPassword returns the bcrypt hash to store.
func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), BcryptCost)
	return string(h), err
}

// dummyHash is compared when the email is unknown, so a wrong email takes
// about as long as a wrong password (the time must not give the email away).
var dummyHash = sync.OnceValue(func() []byte {
	h, err := bcrypt.GenerateFromPassword([]byte("not-a-real-password-just-for-timing"), BcryptCost)
	if err != nil {
		panic(err) // only fails for a bad cost, which is a constant
	}
	return h
})

// WarmUp makes the dummy hash now (it takes a moment), so the first login
// with an unknown email is not slower than the others.
func WarmUp() { dummyHash() }

// passwordMatches compares in bcrypt's own constant-time way. A password
// over 72 bytes is still compared (cut), so it takes the same time, but it
// never matches.
func passwordMatches(hash []byte, password string) bool {
	tooLong := len(password) > MaxPasswordBytes
	if tooLong {
		password = password[:MaxPasswordBytes]
	}
	return bcrypt.CompareHashAndPassword(hash, []byte(password)) == nil && !tooLong
}

// Session is what a successful login gives back. Token goes into the
// cookie and is never stored.
type Session struct {
	Token     string
	ExpiresAt time.Time
	Admin     Admin
}

// newToken returns 32 random bytes (as text for the cookie) and their hash.
func newToken() (token string, hash []byte) {
	b := make([]byte, 32)
	rand.Read(b) // crypto/rand never fails on supported systems
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, HashToken(token)
}

func HashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// Login checks email and password and starts a session.
//   - Unknown email, wrong password and a paused account all return
//     ErrInvalidLogin, after one bcrypt check each (similar time).
//   - Each wrong password counts. At login_max_failures in a row the
//     account pauses for login_lockout_minutes, even for the right password.
func Login(ctx context.Context, pool *pgxpool.Pool, email, password string, now time.Time) (*Session, error) {
	q := db.New(pool)
	set, err := settings.Load(ctx, q)
	if err != nil {
		return nil, err
	}
	email = NormalizeEmail(email)

	var session *Session
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		qtx := q.WithTx(tx)
		a, err := qtx.GetAdminForLogin(ctx, email)
		if errors.Is(err, pgx.ErrNoRows) {
			passwordMatches(dummyHash(), password) // same work as a real check
			return ErrInvalidLogin
		}
		if err != nil {
			return err
		}
		ok := passwordMatches([]byte(a.PasswordHash), password)

		if a.LockedUntil != nil && a.LockedUntil.After(now) {
			return ErrInvalidLogin // paused: not even the right password works
		}
		if !ok {
			failed := a.FailedAttempts
			if a.LockedUntil != nil {
				failed = 0 // an old lockout has ended: start counting again
			}
			failed++
			var lockedUntil *time.Time
			if int(failed) >= set.LoginMaxFailures {
				until := now.Add(time.Duration(set.LoginLockoutMinutes) * time.Minute)
				lockedUntil = &until
			}
			if err := qtx.RecordLoginFailure(ctx, db.RecordLoginFailureParams{
				ID: a.ID, FailedAttempts: failed, LockedUntil: lockedUntil, At: now,
			}); err != nil {
				return err
			}
			// Returning nil commits the counter; the caller still gets
			// ErrInvalidLogin below (session stays nil).
			return nil
		}

		if err := qtx.RecordLoginSuccess(ctx, db.RecordLoginSuccessParams{ID: a.ID, At: now}); err != nil {
			return err
		}
		token, hash := newToken()
		expires := now.Add(SessionMax)
		if err := qtx.InsertAdminSession(ctx, db.InsertAdminSessionParams{
			IDHash: hash, AdminID: a.ID, At: now, ExpiresAt: expires,
		}); err != nil {
			return err
		}
		session = &Session{Token: token, ExpiresAt: expires, Admin: Admin{ID: a.ID, Email: a.Email, Role: string(a.Role)}}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, ErrInvalidLogin
	}
	return session, nil
}

// Authenticate returns the admin behind a session token, and marks the
// session as used now (that restarts the 12-hour idle clock).
func Authenticate(ctx context.Context, q *db.Queries, token string, now time.Time) (Admin, error) {
	if token == "" {
		return Admin{}, ErrNoSession
	}
	hash := HashToken(token)
	row, err := q.GetSessionAdmin(ctx, db.GetSessionAdminParams{IDHash: hash, Now: now, IdleCutoff: now.Add(-SessionIdle)})
	if errors.Is(err, pgx.ErrNoRows) {
		return Admin{}, ErrNoSession
	}
	if err != nil {
		return Admin{}, err
	}
	if err := q.TouchAdminSession(ctx, db.TouchAdminSessionParams{IDHash: hash, At: now}); err != nil {
		return Admin{}, err
	}
	return Admin{ID: row.ID, Email: row.Email, Role: string(row.Role)}, nil
}

// Logout deletes the session, so the cookie's token is useless from now on.
func Logout(ctx context.Context, q *db.Queries, token string) error {
	return q.DeleteAdminSession(ctx, HashToken(token))
}

// CreateOwner makes the one Owner account (cmd/admin create-owner).
// The caller has already checked the email and password.
func CreateOwner(ctx context.Context, pool *pgxpool.Pool, email, password string, now time.Time) (int64, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return 0, err
	}
	q := db.New(pool)
	exists, err := q.OwnerExists(ctx)
	if err != nil {
		return 0, err
	}
	if exists {
		return 0, ErrOwnerExists
	}
	id, err := q.InsertAdmin(ctx, db.InsertAdminParams{Email: NormalizeEmail(email), PasswordHash: hash, Role: db.AdminRoleOWNER, At: now})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		if pgErr.ConstraintName == "admins_one_owner_idx" {
			return 0, ErrOwnerExists
		}
		return 0, ErrEmailTaken
	}
	return id, err
}

// SetPassword gives an admin a new password, ends the lockout and logs
// out every browser of that admin (cmd/admin reset-password).
func SetPassword(ctx context.Context, pool *pgxpool.Pool, email, password string, now time.Time) error {
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		qtx := db.New(tx)
		id, err := qtx.SetAdminPassword(ctx, db.SetAdminPasswordParams{Email: NormalizeEmail(email), PasswordHash: hash, At: now})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNoSuchAdmin
		}
		if err != nil {
			return err
		}
		return qtx.DeleteAdminSessionsFor(ctx, id)
	})
}
