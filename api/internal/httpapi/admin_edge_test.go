package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// Edge cases of the admin: things that happen at the same moment, limits,
// and time boundaries.

// rawRequest sends one request with the given admin cookie (or none). It is
// safe to call from many goroutines at once (adminClient is not).
func rawRequest(s *Server, cookie *http.Cookie, method, path string, body any) (int, string) {
	var reader *bytes.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", testOrigin)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, errorCode(out)
}

// together runs n functions at the same moment and waits for all of them.
func together(n int, f func(i int)) {
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			f(i)
		}()
	}
	close(start)
	wg.Wait()
}

func TestAdminConfirmTwiceAtTheSameMoment(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))

	const n = 10
	statuses := make([]int, n)
	codes := make([]string, n)
	together(n, func(i int) {
		statuses[i], codes[i] = rawRequest(s, c.cookie, "POST", "/api/admin/orders/"+number+"/status", map[string]any{"to": "CONFIRMED"})
	})
	wins := 0
	for i := range n {
		switch {
		case statuses[i] == 200:
			wins++
		case statuses[i] == http.StatusConflict && codes[i] == "BAD_TRANSITION":
		default:
			t.Errorf("request %d: %d %s", i, statuses[i], codes[i])
		}
	}
	if wins != 1 {
		t.Fatalf("%d confirms won, want exactly 1", wins)
	}
	if n := queryInt(t, `SELECT count(*) FROM order_status_history h JOIN orders o ON o.id = h.order_id
	                     WHERE o.order_number = $1 AND h.to_status = 'CONFIRMED'`, number); n != 1 {
		t.Fatalf("CONFIRMED history rows = %d, want 1", n)
	}
}

// The buyer cancels on the website while the admin cancels in the admin:
// only one cancel happens and the stock comes back once.
func TestAdminAndBuyerCancelAtTheSameMoment(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	sleeves := variantID(t, "SLV-100") // stock 48
	number, token := placeTestOrder(t, s, "01712345678", line(sleeves, 2))

	const n = 10
	statuses := make([]int, n)
	codes := make([]string, n)
	together(n, func(i int) {
		if i%2 == 0 {
			statuses[i], codes[i] = rawRequest(s, c.cookie, "POST", "/api/admin/orders/"+number+"/status",
				map[string]any{"to": "CANCELLED", "reason": "Customer called to cancel"})
		} else {
			statuses[i], codes[i] = rawRequest(s, nil, "POST", "/api/orders/cancel",
				map[string]any{"orderNumber": number, "token": token, "reason": "Changed my mind"})
		}
	})
	wins := 0
	for i := range n {
		switch {
		case statuses[i] == 200:
			wins++
		case statuses[i] == http.StatusConflict && (codes[i] == "BAD_TRANSITION" || codes[i] == "CANNOT_CANCEL"):
		default:
			t.Errorf("request %d: %d %s", i, statuses[i], codes[i])
		}
	}
	if wins != 1 {
		t.Fatalf("%d cancels won, want exactly 1", wins)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", sleeves); n != 48 {
		t.Fatalf("stock = %d, want 48 (the 2 pieces back exactly once)", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM inventory_movements WHERE reason = 'CANCEL'"); n != 1 {
		t.Fatalf("CANCEL movements = %d, want 1", n)
	}
}

// The admin takes the last limited drone away (broken) while a buyer orders
// it: only one of them gets it, the stock never goes below 0, and the
// product becomes SOLD_OUT exactly once.
func TestAdminStockChangeAndCheckoutRaceForTheLastPiece(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	drone := variantID(t, "DRN-01")

	for round := range 5 {
		exec(t, "UPDATE product_variants SET stock = 1 WHERE id = $1", drone)
		exec(t, "UPDATE products SET status = 'ACTIVE', sold_out_at = NULL WHERE slug = 'midnight-circuit-desk-drone'")
		exec(t, "DELETE FROM product_events")
		var adminStatus, buyerStatus int
		together(2, func(i int) {
			if i == 0 {
				adminStatus, _ = rawRequest(s, c.cookie, "POST", fmt.Sprintf("/api/admin/variants/%d/stock", drone),
					map[string]any{"change": -1, "reason": "ADJUST", "note": "Arrived broken"})
			} else {
				buyerStatus, _ = rawRequest(s, nil, "POST", "/api/orders", orderBody(t, fmt.Sprintf("0171234500%d", round), line(drone, 1)))
			}
		})
		won := 0
		if adminStatus == 200 {
			won++
		}
		if buyerStatus == http.StatusCreated {
			won++
		}
		if won != 1 {
			t.Fatalf("round %d: admin %d, buyer %d: want exactly one winner", round, adminStatus, buyerStatus)
		}
		if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", drone); n != 0 {
			t.Fatalf("round %d: stock = %d", round, n)
		}
		if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'SOLD_OUT'"); n != 1 {
			t.Fatalf("round %d: SOLD_OUT events = %d, want 1", round, n)
		}
	}
}

// Two returns typed at the same moment can never refund more than was paid
// or bring back more pieces than were bought.
func TestTwoReturnsAtTheSameMoment(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	ball := variantID(t, "BALL-5")
	number, items := deliveredOrder(t, s, c, "01712345678", line(ball, 2)) // paid 2 × 1800 + 60 = ৳3,660
	stockBefore := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball)

	const n = 8
	statuses := make([]int, n)
	together(n, func(i int) {
		statuses[i], _ = rawRequest(s, c.cookie, "POST", "/api/admin/orders/"+number+"/returns",
			returnBody([]map[string]any{back(items[0], 1, true)}, 180000))
	})
	wins := 0
	for _, st := range statuses {
		if st == 200 {
			wins++
		} else if st != http.StatusConflict {
			t.Errorf("status %d", st)
		}
	}
	if wins != 2 {
		t.Fatalf("%d returns recorded, want 2 (only 2 balls were bought)", wins)
	}
	if n := queryInt(t, "SELECT COALESCE(sum(refund_paisa), 0)::int FROM returns"); n > 366000 {
		t.Fatalf("refunded %d paisa, more than the 366000 paid", n)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball); n != stockBefore+2 {
		t.Fatalf("stock = %d, want %d", n, stockBefore+2)
	}
}

func TestAdminLoginOddInput(t *testing.T) {
	s := newTestServer(t, false)
	createTestOwner(t)
	c := newAdminClient(t, s)
	for name, body := range map[string]any{
		"very long password": map[string]any{"email": ownerEmail, "password": strings.Repeat("p", 500)},
		"72 bytes + more":    map[string]any{"email": ownerEmail, "password": ownerPassword + strings.Repeat("x", 80)},
		"very long email":    map[string]any{"email": strings.Repeat("e", 5000) + "@x.com", "password": ownerPassword},
		"spaces in email":    map[string]any{"email": "owner @drakon.test", "password": ownerPassword},
	} {
		status, out := c.do("POST", "/api/admin/login", body)
		if status != http.StatusUnauthorized || errorCode(out) != "INVALID_LOGIN" {
			t.Errorf("%s: %d %v", name, status, out)
		}
	}
	if status, out := c.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": ownerPassword, "role": "OWNER"}); status != 400 || errorCode(out) != "UNKNOWN_FIELD" {
		t.Errorf("extra field: %d %v", status, out)
	}
	if c.cookie != nil {
		t.Fatal("an odd login set a cookie")
	}
	// The two over-long passwords for the real email count as wrong tries;
	// the two unknown emails have no account to count against.
	if n := queryInt(t, "SELECT failed_attempts FROM admins"); n != 2 {
		t.Fatalf("failed_attempts = %d, want 2", n)
	}
}

func TestAdminBadBodies(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))

	req := httptest.NewRequest("POST", "/api/admin/orders/"+number+"/status", strings.NewReader("{not json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", testOrigin)
	req.AddCookie(c.cookie)
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatalf("broken JSON: %d %s", rec.Code, rec.Body.String())
	}
	req = httptest.NewRequest("POST", "/api/admin/orders/"+number+"/status", strings.NewReader(`{"to":"CONFIRMED"}`))
	req.Header.Set("Content-Type", "text/plain")
	req.Header.Set("Origin", testOrigin)
	req.AddCookie(c.cookie)
	rec = httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("text/plain: %d", rec.Code)
	}
	if got := queryString(t, "SELECT status::text FROM orders WHERE order_number = $1", number); got != "PENDING" {
		t.Fatalf("a refused body changed the order: %s", got)
	}

	for path, body := range map[string]any{
		"/api/admin/settings":         map[string]any{"values": map[string]any{}},
		"/api/admin/categories/order": map[string]any{"ids": []int64{1, 1, 2, 3}},
	} {
		if status, _ := c.do("PUT", path, body); status != 422 {
			t.Errorf("PUT %s %v: %d", path, body, status)
		}
	}
	inside := zoneID(t, "INSIDE_DHAKA")
	if status, out := c.do("PUT", fmt.Sprintf("/api/admin/delivery/zones/%d", inside), map[string]any{"name": "Inside Dhaka", "chargePaisa": 6000, "freeOverPaisa": 0, "isActive": true}); status != 422 || fieldError(out, "freeOverPaisa") == "" {
		t.Errorf("free over ৳0: %d %v", status, out)
	}
	if status, _ := c.do("GET", "/api/admin/products/0", nil); status != 404 {
		t.Errorf("product 0: %d", status)
	}
	if status, _ := c.do("GET", "/api/admin/products/abc", nil); status != 404 {
		t.Errorf("product abc: %d", status)
	}
}

func TestAdminProductEdgeCases(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)

	// A draft whose only variant is turned off cannot be published.
	id, vid := draftProduct(t, c, "Edge deck")
	c.do("PUT", fmt.Sprintf("/api/admin/variants/%d", vid), map[string]any{"sku": fmt.Sprintf("TST-%d", id), "label": "Standard", "pricePaisa": 160000, "isActive": false})
	if status, out := publish(t, c, id); status != 409 || errorCode(out) != "CANNOT_PUBLISH" {
		t.Fatalf("publish with no active variant: %d %v", status, out)
	}

	// No price fix on a sold-out product (only ACTIVE).
	drone := variantID(t, "DRN-01")
	stock(t, c, drone, -3, "ADJUST", "Three arrived broken")
	if status, out := c.do("POST", fmt.Sprintf("/api/admin/variants/%d/price-fix", drone), map[string]any{"pricePaisa": 350000, "reason": "Typo in the price"}); status != 409 || errorCode(out) != "NOT_LIVE" {
		t.Fatalf("price fix on SOLD_OUT: %d %v", status, out)
	}

	// Limits on a stock change and on a photo order.
	if status, out := stock(t, c, variantID(t, "SLV-100"), 100001, "RESTOCK", "Far too many"); status != 422 || fieldError(out, "change") == "" {
		t.Fatalf("huge restock: %d %v", status, out)
	}
	_, body := c.do("GET", fmt.Sprintf("/api/admin/products/%d", id), nil)
	img := int64(num(productOf(body)["images"].([]any)[0].(map[string]any)["id"]))
	if status, _ := c.do("PUT", fmt.Sprintf("/api/admin/products/%d/images/order", id), map[string]any{"ids": []int64{img, img}}); status != 422 {
		t.Fatalf("photo order with a duplicate: %d", status)
	}
	// A photo of another product cannot be put in this product's order.
	other := int64(queryInt(t, "SELECT id FROM product_images WHERE product_id <> $1 LIMIT 1", id))
	if status, _ := c.do("PUT", fmt.Sprintf("/api/admin/products/%d/images/order", id), map[string]any{"ids": []int64{other}}); status != 422 {
		t.Fatalf("photo of another product: %d", status)
	}
	if status, out := c.do("PUT", fmt.Sprintf("/api/admin/variants/%d", vid), map[string]any{"sku": fmt.Sprintf("TST-%d", id), "label": "Standard", "pricePaisa": 160000, "imageIndex": -1}); status != 422 || fieldError(out, "imageIndex") == "" {
		t.Fatalf("imageIndex -1: %d %v", status, out)
	}
	if status, _ := c.do("POST", "/api/admin/products/999999/variants", map[string]any{"sku": "NOPE-1", "label": "X", "pricePaisa": 100}); status != 404 {
		t.Fatalf("variant for a missing product: %d", status)
	}
}

// "Today" on the dashboard starts at midnight in Bangladesh, not at
// midnight UTC (which is 6 am in Dhaka).
func TestAdminDashboardTodayIsDhakaTime(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	yesterday, _ := deliveredOrder(t, s, c, "01712345678", line(variantID(t, "SLV-100"), 1))
	today, _ := deliveredOrder(t, s, c, "01812345678", line(variantID(t, "SLV-100"), 1))

	dhaka := time.FixedZone("Asia/Dhaka", 6*3600)
	now := time.Date(2026, 10, 18, 0, 30, 0, 0, dhaka) // 18 Oct, 00:30 in Dhaka = 17 Oct 18:30 UTC
	exec(t, "UPDATE orders SET delivered_at = $1 WHERE order_number = $2", time.Date(2026, 10, 17, 23, 50, 0, 0, dhaka), yesterday)
	exec(t, "UPDATE orders SET delivered_at = $1 WHERE order_number = $2", time.Date(2026, 10, 18, 0, 10, 0, 0, dhaka), today)
	exec(t, "UPDATE orders SET delivered_at = $1 WHERE order_number NOT IN ($2, $3)", time.Date(2026, 10, 1, 12, 0, 0, 0, dhaka), yesterday, today)
	s.now = func() time.Time { return now }
	// The session was made with the real clock; keep it alive for this clock.
	exec(t, "UPDATE admin_sessions SET created_at = $1, last_seen_at = $1, expires_at = $2", now, now.Add(time.Hour))

	status, body := c.do("GET", "/api/admin/dashboard", nil)
	if status != 200 {
		t.Fatalf("dashboard: %d %v", status, body)
	}
	if d := body["deliveredToday"].(map[string]any); num(d["orders"]) != 1 {
		t.Fatalf("deliveredToday = %v, want only the 00:10 one", d)
	}
	if d := body["deliveredLast7Days"].(map[string]any); num(d["orders"]) != 2 {
		t.Fatalf("deliveredLast7Days = %v, want both", d)
	}
}
