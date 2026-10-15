package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"sync"
	"testing"
	"time"

	"github.com/abs-rio09/drakon/api/internal/db"
)

// orderBody is a valid checkout for Dhaka city with the given cart lines.
func orderBody(t *testing.T, phone string, lines ...map[string]any) map[string]any {
	t.Helper()
	return map[string]any{
		"items":          lines,
		"deliveryAreaId": areaID(t, "Dhaka", "Dhaka city"),
		"name":           "Nusrat Jahan",
		"phone":          phone,
		"email":          "",
		"area":           "Mirpur 10",
		"address":        "House 12, Road 3, Block C, near the mosque",
		"courierNote":    "Call before coming",
		"isGift":         false,
		"giftName":       "",
		"giftPhone":      "",
		"giftNote":       "",
		"hidePrices":     false,
	}
}

func line(id int64, qty int) map[string]any { return map[string]any{"variantId": id, "qty": qty} }

func queryInt(t *testing.T, sql string, args ...any) int {
	t.Helper()
	var n int
	if err := testDB.Pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
	return n
}

func queryString(t *testing.T, sql string, args ...any) string {
	t.Helper()
	var s string
	if err := testDB.Pool.QueryRow(context.Background(), sql, args...).Scan(&s); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
	return s
}

var orderNumberRe = regexp.MustCompile(`^DRK-[2-9A-HJ-NP-Z]{6}$`)

func TestPlaceOrderHappyPath(t *testing.T) {
	s := newTestServer(t, true)
	metal := variantID(t, "DF01-METAL") // ৳1,490, stock 3
	ball := variantID(t, "BALL-5")      // ৳1,800, stock 20
	body := orderBody(t, "+880 1712-345678", line(metal, 1), line(ball, 2))
	body["email"] = "  nusrat@example.com "
	body["isGift"] = true
	body["giftName"] = "Rafi"
	body["giftPhone"] = "01812345678"
	body["giftNote"] = "Happy birthday"
	body["hidePrices"] = true

	status, res := do(t, s, http.MethodPost, "/api/orders", body)
	if status != http.StatusCreated {
		t.Fatalf("status %d %v", status, res)
	}
	number, _ := res["orderNumber"].(string)
	token, _ := res["trackToken"].(string)
	if !orderNumberRe.MatchString(number) || len(token) < 40 {
		t.Fatalf("number %q token %q", number, token)
	}
	order := res["order"].(map[string]any)
	if order["status"] != "PENDING" || num(order["subtotalPaisa"]) != 509000 || num(order["deliveryPaisa"]) != 6000 ||
		num(order["totalPaisa"]) != 515000 || order["canCancel"] != true || num(order["codConfirmHours"]) != 48 {
		t.Fatalf("order = %v", order)
	}
	if _, leaked := order["phone"]; leaked {
		t.Fatal("the order view must not contain the phone")
	}

	// Database: the order row with normalized phone, snapshots, gift fields.
	var phone, email, district, zone, giftPhone string
	var districtArea *string
	var hide bool
	var hash []byte
	err := testDB.Pool.QueryRow(context.Background(), `SELECT phone, email, district, district_area, zone_code,
		gift_receiver_phone, gift_hide_prices, track_token_hash FROM orders WHERE order_number = $1`, number).
		Scan(&phone, &email, &district, &districtArea, &zone, &giftPhone, &hide, &hash)
	if err != nil {
		t.Fatal(err)
	}
	if phone != "01712345678" || email != "nusrat@example.com" || district != "Dhaka" || districtArea == nil ||
		*districtArea != "Dhaka city" || zone != "INSIDE_DHAKA" || giftPhone != "01812345678" || !hide || len(hash) != 32 {
		t.Fatalf("row: %s %s %s %v %s %s %v", phone, email, district, districtArea, zone, giftPhone, hide)
	}
	if bytes.Contains(hash, []byte(token)) {
		t.Fatal("the raw token must not be stored")
	}

	// Stock went down, with the stock book and the other rows.
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", metal); n != 2 {
		t.Errorf("metal stock = %d, want 2", n)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball); n != 18 {
		t.Errorf("ball stock = %d, want 18", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM inventory_movements WHERE reason = 'ORDER' AND change < 0"); n != 2 {
		t.Errorf("movements = %d", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM order_items WHERE variant_label = 'Metal' AND unit_price_paisa = 149000 AND product_name = 'Dragon Flame Card · Edition 01'"); n != 1 {
		t.Errorf("item snapshot missing")
	}
	if n := queryInt(t, "SELECT count(*) FROM order_status_history WHERE to_status = 'PENDING' AND from_status IS NULL AND actor = 'CUSTOMER'"); n != 1 {
		t.Errorf("history rows = %d", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM payments WHERE method = 'COD' AND status = 'PENDING' AND amount_paisa = 515000"); n != 1 {
		t.Errorf("payment rows = %d", n)
	}
	// The football is not limited and the card still has stock: both stay ACTIVE.
	if n := queryInt(t, "SELECT count(*) FROM products WHERE status = 'SOLD_OUT'"); n != 2 {
		t.Errorf("sold out products = %d, want the 2 seeded ones", n)
	}
}

func TestPlaceOrderIgnoresClientPrices(t *testing.T) {
	s := newTestServer(t, true)
	body := orderBody(t, "01712345678", map[string]any{"variantId": variantID(t, "BALL-5"), "qty": 1, "pricePaisa": 100})
	status, res := do(t, s, http.MethodPost, "/api/orders", body)
	// Unknown fields are refused outright, so a price can never sneak in.
	if status != http.StatusBadRequest || errorCode(res) != "UNKNOWN_FIELD" {
		t.Fatalf("price in line: %d %v", status, res)
	}
	body = orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1))
	body["totalPaisa"] = 100
	status, res = do(t, s, http.MethodPost, "/api/orders", body)
	if status != http.StatusBadRequest || errorCode(res) != "UNKNOWN_FIELD" {
		t.Fatalf("total in body: %d %v", status, res)
	}
	if n := queryInt(t, "SELECT count(*) FROM orders"); n != 0 {
		t.Fatalf("orders = %d", n)
	}
	// And a normal order is charged the database price.
	status, res = do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1)))
	if status != 201 || num(res["order"].(map[string]any)["totalPaisa"]) != 180000+6000 {
		t.Fatalf("got %d %v", status, res)
	}
}

func TestPlaceOrderValidation(t *testing.T) {
	s := newTestServer(t, true)
	body := orderBody(t, "12345", line(variantID(t, "BALL-5"), 1))
	body["name"] = "A"
	body["email"] = "not-an-email"
	body["address"] = "short"
	body["area"] = " "
	body["deliveryAreaId"] = nil
	body["courierNote"] = string(bytes.Repeat([]byte("x"), 201))
	body["isGift"] = true
	body["giftNote"] = string(bytes.Repeat([]byte("ঁ"), 151)) // counted in letters, not bytes
	status, res := do(t, s, http.MethodPost, "/api/orders", body)
	if status != http.StatusUnprocessableEntity || errorCode(res) != "VALIDATION" {
		t.Fatalf("got %d %v", status, res)
	}
	fields := res["error"].(map[string]any)["fields"].(map[string]any)
	for _, f := range []string{"name", "phone", "email", "district", "area", "address", "courierNote", "giftName", "giftPhone", "giftNote"} {
		if _, ok := fields[f]; !ok {
			t.Errorf("no error for %s (got %v)", f, fields)
		}
	}
	// 150 letters is fine.
	body = orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1))
	body["isGift"], body["giftName"], body["giftPhone"] = true, "Rafi", "8801812345678"
	body["giftNote"] = string(bytes.Repeat([]byte("ঁ"), 150))
	if status, res := do(t, s, http.MethodPost, "/api/orders", body); status != 201 {
		t.Fatalf("150-letter note: %d %v", status, res)
	}
	// Unknown delivery area.
	body = orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1))
	body["deliveryAreaId"] = 999999
	if status, res := do(t, s, http.MethodPost, "/api/orders", body); status != 422 || errorCode(res) != "UNKNOWN_AREA" {
		t.Fatalf("unknown area: %d %v", status, res)
	}
}

func TestPlaceOrderNotAGiftDropsGiftFields(t *testing.T) {
	s := newTestServer(t, true)
	body := orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1))
	body["giftName"], body["giftPhone"], body["giftNote"] = "Rafi", "bad", "typed then unticked"
	if status, res := do(t, s, http.MethodPost, "/api/orders", body); status != 201 {
		t.Fatalf("%d %v", status, res)
	}
	if n := queryInt(t, "SELECT count(*) FROM orders WHERE gift_receiver_name IS NULL AND gift_note = ''"); n != 1 {
		t.Fatal("gift fields were stored for a non-gift order")
	}
}

func TestPlaceOrderOutOfStock(t *testing.T) {
	s := newTestServer(t, true)
	drone := variantID(t, "DRN-01") // stock 3
	status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1), line(drone, 4)))
	if status != http.StatusConflict || errorCode(res) != "OUT_OF_STOCK" {
		t.Fatalf("got %d %v", status, res)
	}
	msg := res["error"].(map[string]any)["message"].(string)
	if !regexp.MustCompile(`Midnight Circuit Desk Drone`).MatchString(msg) {
		t.Errorf("message should name the item: %q", msg)
	}
	// Nothing changed: no order, and the ball's stock is untouched (rollback).
	if n := queryInt(t, "SELECT count(*) FROM orders"); n != 0 {
		t.Errorf("orders = %d", n)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'BALL-5'"); n != 20 {
		t.Errorf("ball stock = %d", n)
	}
	// A sold out run in the archive cannot be ordered either.
	status, res = do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(variantID(t, "FND-STD"), 1)))
	if status != http.StatusConflict || errorCode(res) != "UNAVAILABLE" {
		t.Fatalf("archived: %d %v", status, res)
	}
}

// Two (here: ten) buyers try to buy the LAST drone at the same moment.
// Exactly one gets it; the stock ends at 0, never below.
func TestPlaceOrderRaceForLastItem(t *testing.T) {
	s := newTestServer(t, true)
	drone := variantID(t, "DRN-01")
	exec(t, "UPDATE product_variants SET stock = 1 WHERE id = $1", drone)
	handler := s.Handler()

	const buyers = 10
	statuses := make([]int, buyers)
	codes := make([]string, buyers)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range buyers {
		raw, _ := json.Marshal(orderBody(t, "0171234560"+string(rune('0'+i)), line(drone, 1)))
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start // everyone waits here, then all go at once
			req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewReader(raw))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			statuses[i] = rec.Code
			var body map[string]any
			_ = json.Unmarshal(rec.Body.Bytes(), &body)
			codes[i] = errorCode(body)
		}()
	}
	close(start)
	wg.Wait()

	wins := 0
	for i, st := range statuses {
		switch {
		case st == http.StatusCreated:
			wins++
		// Losers either saw stock 0 / failed the guarded UPDATE (OUT_OF_STOCK),
		// or arrived after the winner made the drone SOLD_OUT (UNAVAILABLE).
		case st == http.StatusConflict && (codes[i] == "OUT_OF_STOCK" || codes[i] == "UNAVAILABLE"):
		default:
			t.Errorf("buyer %d: status %d code %s", i, st, codes[i])
		}
	}
	if wins != 1 {
		t.Fatalf("%d buyers got the last drone, want exactly 1", wins)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", drone); n != 0 {
		t.Fatalf("stock = %d, want 0", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM orders"); n != 1 {
		t.Fatalf("orders = %d, want 1", n)
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "SOLD_OUT" {
		t.Fatalf("drone status = %s, want SOLD_OUT", st)
	}
}

func TestPlaceOrderPurchaseLimitAcrossOrders(t *testing.T) {
	s := newTestServer(t, true)
	paper := variantID(t, "DF01-PAPER") // card limit 2
	metal := variantID(t, "DF01-METAL")
	if status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(paper, 1))); status != 201 {
		t.Fatalf("first order: %d %v", status, res)
	}
	// Same phone (typed differently): 1 earlier + 2 now = 3 > 2.
	status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "8801712345678", line(metal, 2)))
	if status != http.StatusConflict || errorCode(res) != "PURCHASE_LIMIT" {
		t.Fatalf("second order: %d %v", status, res)
	}
	// 1 more is fine (1 + 1 = 2).
	if status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(metal, 1))); status != 201 {
		t.Fatalf("third order: %d %v", status, res)
	}
	// Another phone has its own limit.
	if status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01912345678", line(paper, 2))); status != 201 {
		t.Fatalf("other phone: %d %v", status, res)
	}
	// Default limit (5) for a product without its own: sleeves.
	sleeves := variantID(t, "SLV-100")
	if status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01512345678", line(sleeves, 6))); status != 409 || errorCode(res) != "PURCHASE_LIMIT" {
		t.Fatalf("default limit: %d %v", status, res)
	}
}

func TestPlaceOrderCancelledOrdersDoNotCountTowardsLimit(t *testing.T) {
	s := newTestServer(t, true)
	paper := variantID(t, "DF01-PAPER")
	if status, _ := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(paper, 2))); status != 201 {
		t.Fatal("first order failed")
	}
	exec(t, "UPDATE orders SET status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'test'")
	if status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(paper, 2))); status != 201 {
		t.Fatalf("after cancel: %d %v", status, res)
	}
}

// The same phone sends two orders at once, each for the whole limit.
// The phone lock makes them run one after the other: only one passes.
func TestPlaceOrderLimitRaceSamePhone(t *testing.T) {
	s := newTestServer(t, true)
	paper := variantID(t, "DF01-PAPER")
	handler := s.Handler()
	raw, _ := json.Marshal(orderBody(t, "01712345678", line(paper, 2)))
	var wg sync.WaitGroup
	results := make([]int, 2)
	for i := range results {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodPost, "/api/orders", bytes.NewReader(raw))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			results[i] = rec.Code
		}()
	}
	wg.Wait()
	if !((results[0] == 201 && results[1] == 409) || (results[0] == 409 && results[1] == 201)) {
		t.Fatalf("results = %v, want one 201 and one 409", results)
	}
}

func TestPlaceOrderBlockedPhone(t *testing.T) {
	s := newTestServer(t, true)
	exec(t, "INSERT INTO blocked_phones (phone, reason) VALUES ('01712345678', 'refused 3 parcels')")
	status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "+8801712345678", line(variantID(t, "BALL-5"), 1)))
	if status != http.StatusForbidden || errorCode(res) != "PHONE_BLOCKED" {
		t.Fatalf("got %d %v", status, res)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'BALL-5'"); n != 20 {
		t.Errorf("stock changed for a blocked phone: %d", n)
	}
}

func TestPlaceOrderSetsSoldOut(t *testing.T) {
	s := newTestServer(t, true)
	// Hoodie 02 (limited): S 3, M 4, L 0, XL 6. Leave only S with 1 piece.
	exec(t, "UPDATE product_variants SET stock = 0 WHERE sku IN ('HD02-M', 'HD02-XL')")
	exec(t, "UPDATE product_variants SET stock = 1 WHERE sku = 'HD02-S'")
	if status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(variantID(t, "HD02-S"), 1))); status != 201 {
		t.Fatalf("%d %v", status, res)
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'ember-night-hoodie-edition-02'"); st != "SOLD_OUT" {
		t.Fatalf("hoodie status = %s", st)
	}
	if n := queryInt(t, "SELECT count(*) FROM products WHERE slug = 'ember-night-hoodie-edition-02' AND sold_out_at IS NOT NULL"); n != 1 {
		t.Error("sold_out_at not set")
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'SOLD_OUT' AND actor = 'SYSTEM'"); n != 1 {
		t.Errorf("events = %d", n)
	}
	// It moved from the shop to the archive.
	_, body := do(t, s, http.MethodGet, "/api/sold-out", nil)
	if got := slugs(list(body, "products")); got[0] != "ember-night-hoodie-edition-02" {
		t.Errorf("archive = %v", got)
	}

	// A NON-limited product at stock 0 stays ACTIVE ("Out of stock").
	exec(t, "UPDATE product_variants SET stock = 1 WHERE sku = 'BALL-5'")
	if status, _ := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01912345678", line(variantID(t, "BALL-5"), 1))); status != 201 {
		t.Fatal("ball order failed")
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'night-striker-football'"); st != "ACTIVE" {
		t.Fatalf("football status = %s, want ACTIVE", st)
	}
	// A limited product with stock left in another variant stays ACTIVE.
	if status, _ := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01512345678", line(variantID(t, "DF01-METAL"), 2))); status != 201 {
		t.Fatal("card order failed")
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'dragon-flame-card-edition-01'"); st != "ACTIVE" {
		t.Fatalf("card status = %s", st)
	}
}

// The guarded UPDATE itself, step by step: transaction 1 takes the last
// piece but has not committed yet; transaction 2 tries the same and must
// wait; after 1 commits, 2 sees stock 0 and changes 0 rows.
func TestDecrementStockGuardWithTwoTransactions(t *testing.T) {
	newTestServer(t, true)
	ctx := context.Background()
	ball := variantID(t, "BALL-5")
	exec(t, "UPDATE product_variants SET stock = 1 WHERE id = $1", ball)
	q := db.New(testDB.Pool)

	tx1, err := testDB.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	n1, err := q.WithTx(tx1).DecrementStock(ctx, db.DecrementStockParams{Qty: 1, ID: ball})
	if err != nil || n1 != 1 {
		t.Fatalf("tx1: %d rows, %v", n1, err)
	}

	done := make(chan int64)
	go func() {
		tx2, err := testDB.Pool.Begin(ctx)
		if err != nil {
			done <- -1
			return
		}
		defer tx2.Rollback(ctx)
		n2, err := q.WithTx(tx2).DecrementStock(ctx, db.DecrementStockParams{Qty: 1, ID: ball})
		if err != nil {
			done <- -1
			return
		}
		done <- n2
	}()

	select {
	case n := <-done:
		t.Fatalf("tx2 finished (%d rows) before tx1 committed; it should wait for the row lock", n)
	case <-time.After(200 * time.Millisecond):
	}
	if err := tx1.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if n2 := <-done; n2 != 0 {
		t.Fatalf("tx2 changed %d rows, want 0 (out of stock)", n2)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball); n != 0 {
		t.Fatalf("stock = %d", n)
	}
}

func TestPlaceOrderAppliesFreeDelivery(t *testing.T) {
	s := newTestServer(t, true)
	exec(t, "UPDATE delivery_zones SET free_over_paisa = 300000 WHERE code = 'INSIDE_DHAKA'")
	exec(t, "UPDATE settings SET value = 'true' WHERE key = 'free_delivery_enabled'")
	ball := variantID(t, "BALL-5") // ৳1,800
	// ৳1,800 < ৳3,000: still charged.
	_, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(ball, 1)))
	if num(orderOf(res)["deliveryPaisa"]) != 6000 {
		t.Fatalf("below the line: %v", orderOf(res))
	}
	// ৳3,600 >= ৳3,000: free, and the order and payment rows agree.
	_, res = do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01812345678", line(ball, 2)))
	o := orderOf(res)
	if num(o["deliveryPaisa"]) != 0 || num(o["totalPaisa"]) != 360000 {
		t.Fatalf("free delivery: %v", o)
	}
	if n := queryInt(t, "SELECT count(*) FROM payments WHERE amount_paisa = 360000"); n != 1 {
		t.Error("payment amount should match the free-delivery total")
	}
}

func TestPlaceOrderRefusesDraftProduct(t *testing.T) {
	s := newTestServer(t, true)
	exec(t, "UPDATE products SET status = 'DRAFT' WHERE slug = 'night-striker-football'")
	status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, "01712345678", line(variantID(t, "BALL-5"), 1)))
	if status != http.StatusConflict || errorCode(res) != "UNAVAILABLE" {
		t.Fatalf("got %d %v", status, res)
	}
}
