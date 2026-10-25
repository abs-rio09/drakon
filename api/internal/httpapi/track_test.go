package httpapi

import (
	"net/http"
	"testing"
)

// placeTestOrder places an order and returns its number and secret token.
func placeTestOrder(t *testing.T, s *Server, phone string, lines ...map[string]any) (string, string) {
	t.Helper()
	status, res := do(t, s, http.MethodPost, "/api/orders", orderBody(t, phone, lines...))
	if status != http.StatusCreated {
		t.Fatalf("place order: %d %v", status, res)
	}
	return res["orderNumber"].(string), res["trackToken"].(string)
}

func orderOf(body map[string]any) map[string]any {
	o, _ := body["order"].(map[string]any)
	return o
}

func TestTrackByPhoneAndToken(t *testing.T) {
	s := newTestServer(t, true)
	number, token := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))

	for _, lookup := range []map[string]any{
		{"orderNumber": number, "phone": "+880 1712-345678"},
		{"orderNumber": " " + number[:4] + string([]rune(number)[4:]) + " ", "phone": "01712345678"},
		{"orderNumber": number, "token": token},
	} {
		status, body := do(t, s, http.MethodPost, "/api/orders/track", lookup)
		o := orderOf(body)
		if status != 200 || o["orderNumber"] != number || o["status"] != "PENDING" || o["canCancel"] != true {
			t.Fatalf("%v: %d %v", lookup, status, body)
		}
		timeline := o["timeline"].([]any)
		if len(timeline) != 1 || timeline[0].(map[string]any)["status"] != "PENDING" || o["confirmBy"] == nil {
			t.Fatalf("timeline: %v", o)
		}
		for _, private := range []string{"phone", "name", "address", "email", "area"} {
			if _, ok := o[private]; ok {
				t.Fatalf("track answer contains %s", private)
			}
		}
	}
	// Lower-case number works too.
	lower := map[string]any{"orderNumber": "drk-" + number[4:], "phone": "01712345678"}
	if status, _ := do(t, s, http.MethodPost, "/api/orders/track", lower); status != 200 {
		t.Fatalf("lower-case number: %d", status)
	}
}

func TestTrackWrongNumberAndWrongPhoneLookTheSame(t *testing.T) {
	s := newTestServer(t, true)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))
	cases := []map[string]any{
		{"orderNumber": number, "phone": "01812345678"},       // wrong phone
		{"orderNumber": "DRK-ZZZZZZ", "phone": "01712345678"}, // wrong number
		{"orderNumber": "nonsense", "phone": "01712345678"},   // not even the shape
		{"orderNumber": number, "token": "wrong-token"},       // wrong token
	}
	var first map[string]any
	for i, c := range cases {
		status, body := do(t, s, http.MethodPost, "/api/orders/track", c)
		if status != http.StatusNotFound || errorCode(body) != "ORDER_NOT_FOUND" {
			t.Fatalf("%v: %d %v", c, status, body)
		}
		if i == 0 {
			first = body
		} else if body["error"].(map[string]any)["message"] != first["error"].(map[string]any)["message"] {
			t.Fatalf("different messages: %v vs %v", body, first)
		}
	}
	// Neither phone nor token: a form error, not a lookup.
	if status, body := do(t, s, http.MethodPost, "/api/orders/track", map[string]any{"orderNumber": number}); status != 422 || errorCode(body) != "BAD_LOOKUP" {
		t.Fatalf("no phone: %d %v", status, body)
	}
}

func TestCancelPutsStockBack(t *testing.T) {
	s := newTestServer(t, true)
	ball := variantID(t, "BALL-5")
	metal := variantID(t, "DF01-METAL")
	number, _ := placeTestOrder(t, s, "01712345678", line(ball, 2), line(metal, 1))

	status, body := do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{
		"orderNumber": number, "phone": "01712345678", "reason": "Ordered the wrong size",
	})
	o := orderOf(body)
	if status != 200 || o["status"] != "CANCELLED" || o["canCancel"] != false {
		t.Fatalf("cancel: %d %v", status, body)
	}
	if o["cancelReason"] != "Cancelled by the buyer: Ordered the wrong size" {
		t.Errorf("reason = %v", o["cancelReason"])
	}
	timeline := o["timeline"].([]any)
	last := timeline[len(timeline)-1].(map[string]any)
	if len(timeline) != 2 || last["status"] != "CANCELLED" || last["by"] != "CUSTOMER" {
		t.Errorf("timeline = %v", timeline)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball); n != 20 {
		t.Errorf("ball stock = %d, want 20", n)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", metal); n != 3 {
		t.Errorf("metal stock = %d, want 3", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM inventory_movements WHERE reason = 'CANCEL' AND change > 0"); n != 2 {
		t.Errorf("cancel movements = %d", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM orders WHERE cancelled_at IS NOT NULL"); n != 1 {
		t.Error("cancelled_at not set")
	}
	if st := paymentStatus(t, number); st != "VOID" {
		t.Errorf("payment after the buyer's cancel = %s, want VOID", st)
	}

	// Cancelling twice: refused, and the stock is not added a second time.
	status, body = do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{"orderNumber": number, "phone": "01712345678"})
	if status != http.StatusConflict || errorCode(body) != "CANNOT_CANCEL" {
		t.Fatalf("second cancel: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball); n != 20 {
		t.Errorf("ball stock after second cancel = %d", n)
	}
}

func TestCancelWithTokenAndWithWrongPhone(t *testing.T) {
	s := newTestServer(t, true)
	number, token := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))
	if status, body := do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{"orderNumber": number, "phone": "01812345678"}); status != 404 {
		t.Fatalf("wrong phone: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT count(*) FROM orders WHERE status = 'PENDING'"); n != 1 {
		t.Fatal("a wrong phone must not cancel")
	}
	status, body := do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{"orderNumber": number, "token": token})
	if status != 200 || orderOf(body)["cancelReason"] != "Cancelled by the buyer" {
		t.Fatalf("token cancel: %d %v", status, body)
	}
}

func TestCancelOnlyWhilePendingOrConfirmed(t *testing.T) {
	s := newTestServer(t, true)
	for _, st := range []string{"CONFIRMED", "SHIPPED", "DELIVERED"} {
		number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "SLV-100"), 1))
		exec(t, "UPDATE orders SET status = $1 WHERE order_number = $2", st, number)
		status, body := do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{"orderNumber": number, "phone": "01712345678"})
		want := http.StatusConflict
		if st == "CONFIRMED" {
			want = http.StatusOK
		}
		if status != want {
			t.Errorf("%s: %d %v", st, status, body)
		}
	}
}

func TestCancelBringsSoldOutProductBack(t *testing.T) {
	s := newTestServer(t, true)
	drone := variantID(t, "DRN-01") // limited, stock 3, default limit 5
	number, _ := placeTestOrder(t, s, "01712345678", line(drone, 3))
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "SOLD_OUT" {
		t.Fatalf("after order: %s", st)
	}
	if status, body := do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{"orderNumber": number, "phone": "01712345678"}); status != 200 {
		t.Fatalf("cancel: %d %v", status, body)
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "ACTIVE" {
		t.Fatalf("after cancel: %s, want ACTIVE", st)
	}
	if n := queryInt(t, "SELECT count(*) FROM products WHERE slug = 'midnight-circuit-desk-drone' AND sold_out_at IS NULL"); n != 1 {
		t.Error("sold_out_at should be cleared")
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'REACTIVATE' AND actor = 'CUSTOMER'"); n != 1 {
		t.Errorf("REACTIVATE events = %d", n)
	}
	// It is back in the shop.
	_, body := do(t, s, http.MethodGet, "/api/products?q=drone", nil)
	if len(list(body, "products")) != 1 {
		t.Error("the drone is not back in the shop")
	}
}

func TestCancelDoesNotBringBackArchived(t *testing.T) {
	s := newTestServer(t, true)
	drone := variantID(t, "DRN-01")
	number, _ := placeTestOrder(t, s, "01712345678", line(drone, 3))
	exec(t, "UPDATE products SET status = 'ARCHIVED', archived_at = now() WHERE slug = 'midnight-circuit-desk-drone'")
	if status, _ := do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{"orderNumber": number, "phone": "01712345678"}); status != 200 {
		t.Fatal("cancel failed")
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "ARCHIVED" {
		t.Fatalf("status = %s, want ARCHIVED (only the owner may reactivate)", st)
	}
}

func TestCancelReasonTooLong(t *testing.T) {
	s := newTestServer(t, true)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))
	long := make([]rune, 201)
	for i := range long {
		long[i] = 'x'
	}
	status, body := do(t, s, http.MethodPost, "/api/orders/cancel", map[string]any{"orderNumber": number, "phone": "01712345678", "reason": string(long)})
	if status != 422 || errorCode(body) != "VALIDATION" {
		t.Fatalf("%d %v", status, body)
	}
}

// paymentStatus is the status of the order's (only) payment row.
func paymentStatus(t *testing.T, number string) string {
	t.Helper()
	return queryString(t, "SELECT p.status::text FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.order_number = $1", number)
}
