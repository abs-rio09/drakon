package httpapi

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/abs-rio09/drakon/api/internal/auth"
)

// Test owner account. The password exists only in this test.
const (
	ownerEmail    = "owner@drakon.test"
	ownerPassword = "correct horse battery"
)

// adminClient is a tiny browser for tests: it keeps the session cookie
// between requests (like a cookie jar) and sends the trusted Origin.
type adminClient struct {
	t      *testing.T
	s      *Server
	cookie *http.Cookie
	origin string
	last   *http.Response // the last raw answer (headers, cookies)
}

func newAdminClient(t *testing.T, s *Server) *adminClient {
	return &adminClient{t: t, s: s, origin: testOrigin}
}

func (c *adminClient) do(method, path string, body any) (int, map[string]any) {
	c.t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.t.Fatal(err)
		}
		reader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.origin != "" {
		req.Header.Set("Origin", c.origin)
	}
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	rec := httptest.NewRecorder()
	c.s.Handler().ServeHTTP(rec, req)
	c.last = rec.Result()
	for _, ck := range c.last.Cookies() {
		if ck.Name == adminCookie {
			if ck.MaxAge < 0 {
				c.cookie = nil
			} else {
				c.cookie = ck
			}
		}
	}
	var out map[string]any
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			c.t.Fatalf("%s %s: body is not JSON: %s", method, path, rec.Body.String())
		}
	}
	return rec.Code, out
}

// testClock is a clock the test moves by hand.
type testClock struct{ now time.Time }

func (c *testClock) Now() time.Time      { return c.now }
func (c *testClock) Add(d time.Duration) { c.now = c.now.Add(d) }
func useClock(s *Server, start time.Time) *testClock {
	c := &testClock{now: start}
	s.now = c.Now
	return c
}

var adminStart = time.Date(2026, 10, 18, 9, 0, 0, 0, time.FixedZone("BST", 6*3600))

func createTestOwner(t *testing.T) {
	t.Helper()
	if _, err := auth.CreateOwner(context.Background(), testDB.Pool, ownerEmail, ownerPassword, adminStart); err != nil {
		t.Fatal(err)
	}
}

// loginOwner creates the owner, logs in and returns a client with the cookie.
func loginOwner(t *testing.T, s *Server) *adminClient {
	t.Helper()
	createTestOwner(t)
	c := newAdminClient(t, s)
	status, body := c.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": ownerPassword})
	if status != http.StatusOK || c.cookie == nil {
		t.Fatalf("login: %d %v", status, body)
	}
	return c
}

// allowManyLogins lifts the per-IP login limit for a test that is about
// something else (the account lockout, odd input) and needs many tries.
func allowManyLogins(t *testing.T) {
	t.Helper()
	exec(t, `UPDATE settings SET value = '100' WHERE key = 'rate_login_tries'`)
}

func TestAdminLoginWorks(t *testing.T) {
	s := newTestServer(t, false)
	useClock(s, adminStart)
	createTestOwner(t)
	c := newAdminClient(t, s)

	// Email in any case, with spaces: still the same account.
	status, body := c.do("POST", "/api/admin/login", map[string]any{"email": "  Owner@Drakon.TEST ", "password": ownerPassword})
	if status != 200 || body["admin"].(map[string]any)["email"] != ownerEmail {
		t.Fatalf("login: %d %v", status, body)
	}
	ck := c.cookie
	if ck == nil || !ck.HttpOnly || !ck.Secure || ck.SameSite != http.SameSiteLaxMode || ck.Path != "/api/admin" || len(ck.Value) < 40 {
		t.Fatalf("cookie = %+v", ck)
	}
	if got := c.last.Header.Get("Cache-Control"); got != "no-store" {
		t.Fatalf("Cache-Control = %q", got)
	}

	// Only the hash of the token is in the database.
	sum := sha256.Sum256([]byte(ck.Value))
	if n := queryInt(t, "SELECT count(*) FROM admin_sessions WHERE id_hash = $1", sum[:]); n != 1 {
		t.Fatalf("sessions with the token hash = %d", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM admin_sessions WHERE encode(id_hash, 'escape') = $1", ck.Value); n != 0 {
		t.Fatal("the raw token is stored")
	}

	status, body = c.do("GET", "/api/admin/me", nil)
	if status != 200 || body["admin"].(map[string]any)["role"] != "OWNER" {
		t.Fatalf("me: %d %v", status, body)
	}
}

func TestAdminWrongPasswordAndUnknownEmailLookTheSame(t *testing.T) {
	s := newTestServer(t, false)
	useClock(s, adminStart)
	createTestOwner(t)
	c := newAdminClient(t, s)

	start := time.Now()
	s1, b1 := c.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": "wrong password!!"})
	wrongPassword := time.Since(start)
	start = time.Now()
	s2, b2 := c.do("POST", "/api/admin/login", map[string]any{"email": "nobody@drakon.test", "password": "wrong password!!"})
	unknownEmail := time.Since(start)
	// Both ran one bcrypt check (cost 12 takes well over 50 ms), so the time
	// does not tell which emails exist.
	if wrongPassword < 50*time.Millisecond || unknownEmail < 50*time.Millisecond {
		t.Fatalf("too fast, bcrypt was skipped: wrong password %v, unknown email %v", wrongPassword, unknownEmail)
	}
	if s1 != http.StatusUnauthorized || s1 != s2 || errorCode(b1) != "INVALID_LOGIN" {
		t.Fatalf("statuses %d %d, %v", s1, s2, b1)
	}
	j1, _ := json.Marshal(b1)
	j2, _ := json.Marshal(b2)
	if !bytes.Equal(j1, j2) {
		t.Fatalf("different answers:\n%s\n%s", j1, j2)
	}
	if c.cookie != nil {
		t.Fatal("a failed login set a cookie")
	}
	// An empty field is a form error, not a login try.
	if status, body := c.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": ""}); status != 422 || errorCode(body) != "VALIDATION" {
		t.Fatalf("empty password: %d %v", status, body)
	}
}

func TestAdminLockoutAndUnlock(t *testing.T) {
	s := newTestServer(t, false)
	clock := useClock(s, adminStart)
	allowManyLogins(t)
	createTestOwner(t)
	c := newAdminClient(t, s)
	wrong := map[string]any{"email": ownerEmail, "password": "not the password"}
	right := map[string]any{"email": ownerEmail, "password": ownerPassword}

	// 4 wrong, then right: the counter starts again from 0.
	for range 4 {
		c.do("POST", "/api/admin/login", wrong)
	}
	if n := queryInt(t, "SELECT failed_attempts FROM admins"); n != 4 {
		t.Fatalf("failed_attempts = %d, want 4", n)
	}
	if status, _ := c.do("POST", "/api/admin/login", right); status != 200 {
		t.Fatalf("right password after 4 wrong: %d", status)
	}
	if n := queryInt(t, "SELECT failed_attempts FROM admins"); n != 0 {
		t.Fatalf("failed_attempts after success = %d", n)
	}

	// 5 wrong in a row: paused, even for the right password.
	for range 5 {
		c.do("POST", "/api/admin/login", wrong)
	}
	clock.Add(14 * time.Minute)
	status, body := c.do("POST", "/api/admin/login", right)
	if status != http.StatusUnauthorized || errorCode(body) != "INVALID_LOGIN" {
		t.Fatalf("locked account with the right password: %d %v", status, body)
	}

	// 15 minutes after the 5th wrong try: open again.
	clock.Add(time.Minute + time.Second)
	if status, body := c.do("POST", "/api/admin/login", right); status != 200 {
		t.Fatalf("after the lockout: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT count(*) FROM admins WHERE failed_attempts = 0 AND locked_until IS NULL"); n != 1 {
		t.Fatal("lockout not cleared after a good login")
	}
}

func TestAdminLockoutNumbersComeFromSettings(t *testing.T) {
	s := newTestServer(t, false)
	useClock(s, adminStart)
	createTestOwner(t)
	exec(t, `UPDATE settings SET value = '2' WHERE key = 'login_max_failures'`)
	c := newAdminClient(t, s)
	wrong := map[string]any{"email": ownerEmail, "password": "not the password"}
	c.do("POST", "/api/admin/login", wrong)
	_, body := c.do("POST", "/api/admin/login", wrong)
	if n := queryInt(t, "SELECT count(*) FROM admins WHERE locked_until IS NOT NULL"); n != 1 {
		t.Fatal("not locked after 2 failures")
	}
	msg := body["error"].(map[string]any)["message"].(string)
	if msg != "Wrong email or password. After 2 wrong tries in a row, login pauses for 15 minutes." {
		t.Fatalf("message = %q", msg)
	}
}

func TestAdminSessionExpires(t *testing.T) {
	s := newTestServer(t, false)
	clock := useClock(s, adminStart)
	c := loginOwner(t, s)

	// Idle: 11 hours later still fine (and that use restarts the idle clock).
	clock.Add(11 * time.Hour)
	if status, _ := c.do("GET", "/api/admin/me", nil); status != 200 {
		t.Fatalf("after 11 h: %d", status)
	}
	// 12 hours without use: logged out, and the browser is told to drop the cookie.
	clock.Add(12*time.Hour + time.Second)
	if status, body := c.do("GET", "/api/admin/me", nil); status != 401 || errorCode(body) != "UNAUTHORIZED" {
		t.Fatalf("after 12 h idle: %d %v", status, body)
	}
	if c.cookie != nil {
		t.Fatal("dead cookie was not cleared")
	}

	// Used every 10 hours: still ends 7 days after login.
	c = newAdminClient(t, s)
	if status, _ := c.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": ownerPassword}); status != 200 {
		t.Fatal("login again")
	}
	loginAt := clock.Now()
	for clock.Now().Before(loginAt.Add(auth.SessionMax - 10*time.Hour)) {
		clock.Add(10 * time.Hour)
		if status, _ := c.do("GET", "/api/admin/me", nil); status != 200 {
			t.Fatalf("at %v: %d", clock.Now().Sub(loginAt), status)
		}
	}
	clock.now = loginAt.Add(auth.SessionMax + time.Second)
	if status, _ := c.do("GET", "/api/admin/me", nil); status != 401 {
		t.Fatalf("after 7 days: %d", status)
	}
}

func TestAdminLogoutKillsTheSession(t *testing.T) {
	s := newTestServer(t, false)
	useClock(s, adminStart)
	c := loginOwner(t, s)
	old := c.cookie

	if status, _ := c.do("POST", "/api/admin/logout", nil); status != 200 {
		t.Fatalf("logout: %d", status)
	}
	if c.cookie != nil {
		t.Fatal("logout did not clear the cookie")
	}
	if n := queryInt(t, "SELECT count(*) FROM admin_sessions"); n != 0 {
		t.Fatalf("sessions left = %d", n)
	}
	// Someone who copied the old cookie cannot use it.
	c.cookie = old
	if status, _ := c.do("GET", "/api/admin/me", nil); status != 401 {
		t.Fatalf("old cookie after logout: %d", status)
	}
}

func TestAdminBadOriginIsRefused(t *testing.T) {
	s := newTestServer(t, false)
	useClock(s, adminStart)
	c := loginOwner(t, s)

	for _, origin := range []string{"https://evil.example", "", "null", "http://localhost:5173/"} {
		c.origin = origin
		status, body := c.do("POST", "/api/admin/logout", nil)
		if status != http.StatusForbidden || errorCode(body) != "BAD_ORIGIN" {
			t.Fatalf("origin %q: %d %v", origin, status, body)
		}
		status, _ = c.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": ownerPassword})
		if status != http.StatusForbidden {
			t.Fatalf("login from origin %q: %d", origin, status)
		}
	}
	// The session survived the refused logouts. GET needs no Origin.
	c.origin = ""
	if status, _ := c.do("GET", "/api/admin/me", nil); status != 200 {
		t.Fatalf("me after refused logouts: %d", status)
	}
}

// Every admin route must answer 401 without a session. When you add an
// admin route, add it here too: the last check fails if the list and the
// router's table (admin_routes.go) do not match.
func TestEveryAdminRouteNeedsASession(t *testing.T) {
	s := newTestServer(t, false)
	routes := []struct{ method, path string }{
		{"GET", "/api/admin/me"},
		{"POST", "/api/admin/logout"},

		{"GET", "/api/admin/dashboard"},
		{"GET", "/api/admin/orders"},
		{"GET", "/api/admin/orders/call-list"},
		{"GET", "/api/admin/orders/DRK-AAAAAA"},
		{"POST", "/api/admin/orders/DRK-AAAAAA/status"},
		{"PUT", "/api/admin/orders/DRK-AAAAAA/note"},
		{"POST", "/api/admin/orders/DRK-AAAAAA/returns"},
		{"GET", "/api/admin/blocked-phones"},
		{"POST", "/api/admin/blocked-phones"},
		{"POST", "/api/admin/blocked-phones/unblock"},

		{"GET", "/api/admin/products"},
		{"POST", "/api/admin/products"},
		{"GET", "/api/admin/products/1"},
		{"PUT", "/api/admin/products/1"},
		{"POST", "/api/admin/products/1/publish"},
		{"POST", "/api/admin/products/1/archive"},
		{"POST", "/api/admin/products/1/reactivate"},
		{"POST", "/api/admin/products/1/variants"},
		{"PUT", "/api/admin/variants/1"},
		{"POST", "/api/admin/variants/1/stock"},
		{"POST", "/api/admin/variants/1/price-fix"},
		{"POST", "/api/admin/products/1/images"},
		{"PUT", "/api/admin/products/1/images/order"},
		{"PUT", "/api/admin/images/1"},
		{"DELETE", "/api/admin/images/1"},

		{"GET", "/api/admin/categories"},
		{"POST", "/api/admin/categories"},
		{"PUT", "/api/admin/categories/order"},
		{"PUT", "/api/admin/categories/1"},
		{"GET", "/api/admin/settings"},
		{"PUT", "/api/admin/settings"},
		{"GET", "/api/admin/delivery"},
		{"POST", "/api/admin/delivery/zones"},
		{"PUT", "/api/admin/delivery/zones/1"},
		{"POST", "/api/admin/delivery/areas"},
		{"PUT", "/api/admin/delivery/areas/1"},
	}

	c := newAdminClient(t, s)
	for _, rt := range routes {
		status, body := c.do(rt.method, rt.path, map[string]any{})
		if status != http.StatusUnauthorized || errorCode(body) != "UNAUTHORIZED" {
			t.Errorf("%s %s without a session: %d %v", rt.method, rt.path, status, body)
		}
		if got := c.last.Header.Get("Cache-Control"); got != "no-store" {
			t.Errorf("%s %s: Cache-Control = %q", rt.method, rt.path, got)
		}
	}
	// A made-up cookie is no better than none.
	c.cookie = &http.Cookie{Name: adminCookie, Value: "made-up-token"}
	for _, rt := range routes {
		if status, _ := c.do(rt.method, rt.path, map[string]any{}); status != http.StatusUnauthorized {
			t.Errorf("%s %s with a fake cookie: %d", rt.method, rt.path, status)
		}
	}

	table := s.adminRoutes()
	if len(table) != len(routes) {
		t.Fatalf("admin_routes.go has %d routes, this test lists %d: add the new route here", len(table), len(routes))
	}
	for i, rt := range table {
		pattern := routes[i].path
		if rt.Method != routes[i].method || !samePattern(rt.Path, pattern) {
			t.Errorf("route %d: table has %s %s, test has %s %s", i, rt.Method, rt.Path, routes[i].method, pattern)
		}
	}
}

// samePattern: "/api/admin/orders/{number}" matches "/api/admin/orders/DRK-AAAAAA".
func samePattern(pattern, path string) bool {
	ps, xs := strings.Split(pattern, "/"), strings.Split(path, "/")
	if len(ps) != len(xs) {
		return false
	}
	for i := range ps {
		if ps[i] != xs[i] && !strings.HasPrefix(ps[i], "{") {
			return false
		}
	}
	return true
}

func TestOnlyOneOwnerAndPasswordReset(t *testing.T) {
	s := newTestServer(t, false)
	useClock(s, adminStart)
	c := loginOwner(t, s)
	ctx := context.Background()

	if _, err := auth.CreateOwner(ctx, testDB.Pool, "second@drakon.test", ownerPassword, adminStart); err != auth.ErrOwnerExists {
		t.Fatalf("second owner: %v", err)
	}
	// A new password ends every session of that admin.
	if err := auth.SetPassword(ctx, testDB.Pool, ownerEmail, "a brand new password", adminStart); err != nil {
		t.Fatal(err)
	}
	if status, _ := c.do("GET", "/api/admin/me", nil); status != 401 {
		t.Fatalf("old session after password change: %d", status)
	}
	if status, _ := c.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": "a brand new password"}); status != 200 {
		t.Fatalf("login with the new password: %d", status)
	}
	if err := auth.SetPassword(ctx, testDB.Pool, "nobody@drakon.test", "a brand new password", adminStart); err != auth.ErrNoSuchAdmin {
		t.Fatalf("unknown admin: %v", err)
	}
	// The hash is bcrypt with cost 12, never the password.
	if h := queryString(t, "SELECT password_hash FROM admins"); !strings.HasPrefix(h, "$2a$12$") {
		t.Fatalf("hash = %q", h)
	}
}
