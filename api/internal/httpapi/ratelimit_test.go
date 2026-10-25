package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testProxySecret = "test-proxy-secret-0123456789abcdef"

// postFrom sends one POST as if it came from the address remote, with
// extra headers, and returns the recorder (status, headers, body).
func postFrom(t *testing.T, s *Server, path, remote string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", testOrigin)
	req.RemoteAddr = remote
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	return rec
}

// A track lookup that finds nothing: 404 while under the limit.
var missingOrder = map[string]any{"orderNumber": "DRK-000000001", "phone": "01712345678"}

func setRate(t *testing.T, action string, tries, minutes int) {
	t.Helper()
	exec(t, "UPDATE settings SET value = to_jsonb($1::int) WHERE key = $2", tries, "rate_"+action+"_tries")
	exec(t, "UPDATE settings SET value = to_jsonb($1::int) WHERE key = $2", minutes, "rate_"+action+"_minutes")
}

func TestRateLimitTrack(t *testing.T) {
	s := newTestServer(t, false)
	clock := useClock(s, adminStart)
	setRate(t, "track", 3, 10)

	for i := range 3 {
		if rec := postFrom(t, s, "/api/orders/track", "203.0.113.5:4000", missingOrder, nil); rec.Code != http.StatusNotFound {
			t.Fatalf("try %d: %d, want 404 (under the limit)", i+1, rec.Code)
		}
	}
	clock.now = clock.now.Add(4 * time.Minute)
	rec := postFrom(t, s, "/api/orders/track", "203.0.113.5:4001", missingOrder, nil)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != http.StatusTooManyRequests || errorCode(body) != "TOO_MANY_TRIES" {
		t.Fatalf("4th try: %d %v", rec.Code, body)
	}
	if got := rec.Header().Get("Retry-After"); got != "360" {
		t.Fatalf("Retry-After = %q, want 360 (6 minutes left)", got)
	}
	if msg := body["error"].(map[string]any)["message"]; msg != "Too many tries. Please wait 6 minutes and try again." {
		t.Fatalf("message = %q", msg)
	}

	// Another IP has its own count.
	if rec := postFrom(t, s, "/api/orders/track", "198.51.100.7:4000", missingOrder, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("other IP: %d", rec.Code)
	}
	// The window ends: the first IP may try again.
	clock.now = clock.now.Add(6 * time.Minute)
	if rec := postFrom(t, s, "/api/orders/track", "203.0.113.5:4000", missingOrder, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("after the window: %d", rec.Code)
	}
}

// The limits come from the settings table: a new value counts at once.
func TestRateLimitReadsSettings(t *testing.T) {
	s := newTestServer(t, false)
	useClock(s, adminStart)
	setRate(t, "cancel", 1, 1)
	ip := "203.0.113.9:1"
	postFrom(t, s, "/api/orders/cancel", ip, missingOrder, nil)
	rec := postFrom(t, s, "/api/orders/cancel", ip, missingOrder, nil)
	if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") != "60" {
		t.Fatalf("2nd cancel with a limit of 1: %d %q", rec.Code, rec.Header().Get("Retry-After"))
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte("Please wait a minute")) {
		t.Fatalf("message: %s", rec.Body.String())
	}
	setRate(t, "cancel", 5, 1)
	if rec := postFrom(t, s, "/api/orders/cancel", ip, missingOrder, nil); rec.Code == http.StatusTooManyRequests {
		t.Fatal("still refused after the Owner raised the limit")
	}
}

func TestRateLimitPlaceOrder(t *testing.T) {
	s := newTestServer(t, true)
	setRate(t, "order", 1, 10)
	body := orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1))
	if rec := postFrom(t, s, "/api/orders", "203.0.113.20:1", body, nil); rec.Code != http.StatusCreated {
		t.Fatalf("first order: %d %s", rec.Code, rec.Body.String())
	}
	if rec := postFrom(t, s, "/api/orders", "203.0.113.20:2", body, nil); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second order: %d", rec.Code)
	}
	if n := queryInt(t, "SELECT count(*) FROM orders"); n != 1 {
		t.Fatalf("%d orders saved, want 1", n)
	}
}

// Forwarded-IP headers are typed by the visitor, so they are ignored
// unless TRUSTED_PROXY=cloudflare is set AND the request carries the
// Worker's secret.
func TestRateLimitForwardedHeaders(t *testing.T) {
	spoof := func(i int) map[string]string {
		ip := "10.9.8." + string(rune('1'+i))
		return map[string]string{"X-Forwarded-For": ip, "CF-Connecting-IP": ip, "X-Real-IP": ip, clientIPHeader: ip}
	}

	t.Run("not trusted", func(t *testing.T) {
		s := newTestServer(t, false)
		setRate(t, "track", 2, 10)
		codes := []int{}
		for i := range 3 {
			codes = append(codes, postFrom(t, s, "/api/orders/track", "203.0.113.5:1", missingOrder, spoof(i)).Code)
		}
		if codes[2] != http.StatusTooManyRequests {
			t.Fatalf("a new fake IP per request got around the limit: %v", codes)
		}
	})

	t.Run("trusted, wrong secret", func(t *testing.T) {
		s := newTestServer(t, false)
		s.opts.TrustedProxy, s.opts.ProxySecret = "cloudflare", testProxySecret
		setRate(t, "track", 2, 10)
		codes := []int{}
		for i := range 3 {
			h := spoof(i)
			h[proxySecretHeader] = "guessed"
			codes = append(codes, postFrom(t, s, "/api/orders/track", "203.0.113.5:1", missingOrder, h).Code)
		}
		if codes[2] != http.StatusTooManyRequests {
			t.Fatalf("a wrong secret was trusted: %v", codes)
		}
	})

	t.Run("trusted, right secret", func(t *testing.T) {
		s := newTestServer(t, false)
		s.opts.TrustedProxy, s.opts.ProxySecret = "cloudflare", testProxySecret
		setRate(t, "track", 1, 10)
		// All requests come from the proxy's address; the visitor IP decides.
		visitor := func(ip string) map[string]string {
			return map[string]string{clientIPHeader: ip, proxySecretHeader: testProxySecret}
		}
		if rec := postFrom(t, s, "/api/orders/track", "10.0.0.1:1", missingOrder, visitor("203.0.113.1")); rec.Code != 404 {
			t.Fatalf("visitor 1: %d", rec.Code)
		}
		if rec := postFrom(t, s, "/api/orders/track", "10.0.0.1:1", missingOrder, visitor("203.0.113.2")); rec.Code != 404 {
			t.Fatalf("visitor 2 shared visitor 1's count: %d", rec.Code)
		}
		if rec := postFrom(t, s, "/api/orders/track", "10.0.0.1:1", missingOrder, visitor("203.0.113.1")); rec.Code != 429 {
			t.Fatalf("visitor 1 again: %d", rec.Code)
		}
	})
}

// One IPv6 /64 network is one visitor.
func TestRateLimitIPv6Network(t *testing.T) {
	s := newTestServer(t, false)
	setRate(t, "track", 1, 10)
	postFrom(t, s, "/api/orders/track", "[2001:db8:1:2::1]:1", missingOrder, nil)
	if rec := postFrom(t, s, "/api/orders/track", "[2001:db8:1:2::ffff]:1", missingOrder, nil); rec.Code != 429 {
		t.Fatalf("another address in the same /64: %d", rec.Code)
	}
	if rec := postFrom(t, s, "/api/orders/track", "[2001:db8:1:3::1]:1", missingOrder, nil); rec.Code != 404 {
		t.Fatalf("another /64: %d", rec.Code)
	}
}

// The per-IP limit comes before the password check: refused tries do not
// count towards pausing the Owner's account, and the Owner can still log
// in from another place.
func TestRateLimitLoginBeforeLockout(t *testing.T) {
	s := newTestServer(t, false)
	createTestOwner(t)
	wrong := map[string]any{"email": ownerEmail, "password": "not the password"}
	stranger := "203.0.113.66:1"
	codes := []int{}
	for range 10 {
		codes = append(codes, postFrom(t, s, "/api/admin/login", stranger, wrong, nil).Code)
	}
	// Default: 4 tries per IP in the window, below the 5 that pause the account.
	if codes[3] != http.StatusUnauthorized || codes[4] != http.StatusTooManyRequests || codes[9] != http.StatusTooManyRequests {
		t.Fatalf("codes = %v", codes)
	}
	if n := queryInt(t, "SELECT failed_attempts FROM admins"); n != 4 {
		t.Fatalf("failed_attempts = %d, want 4 (refused tries must not count)", n)
	}
	right := map[string]any{"email": ownerEmail, "password": ownerPassword}
	if rec := postFrom(t, s, "/api/admin/login", "198.51.100.1:1", right, nil); rec.Code != http.StatusOK {
		t.Fatalf("owner from another IP: %d %s", rec.Code, rec.Body.String())
	}
}
