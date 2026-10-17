package httpapi

import (
	"bytes"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"
)

// moveBody is a valid request body for a move to `to`.
func moveBody(to string) map[string]any {
	switch to {
	case "SHIPPED":
		return map[string]any{"to": to, "courierName": "Steadfast", "trackingCode": "SF-4471029"}
	case "CANCELLED":
		return map[string]any{"to": to, "reason": "Customer asked on the phone"}
	}
	return map[string]any{"to": to}
}

func move(c *adminClient, number, to string) (int, map[string]any) {
	c.t.Helper()
	return c.do("POST", "/api/admin/orders/"+number+"/status", moveBody(to))
}

func ownerID(t *testing.T) int {
	return queryInt(t, "SELECT id FROM admins WHERE email = $1", ownerEmail)
}

func TestAdminEveryMoveAllowedOrRefused(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	sleeves := variantID(t, "SLV-100")

	all := []string{"PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"}
	allowed := map[string]bool{
		"PENDING>CONFIRMED": true, "PENDING>CANCELLED": true,
		"CONFIRMED>SHIPPED": true, "CONFIRMED>CANCELLED": true,
		"SHIPPED>DELIVERED": true, "SHIPPED>CANCELLED": true,
	}
	i := 0
	for _, from := range all {
		for _, to := range all {
			i++
			name := from + ">" + to
			number, _ := placeTestOrder(t, s, fmt.Sprintf("0171100%04d", i), line(sleeves, 1))
			// Put the order straight into `from` (a cancelled one needs its reason).
			exec(t, `UPDATE orders SET status = $1::order_status,
			           cancelled_at = CASE WHEN $1 = 'CANCELLED' THEN now() END,
			           cancel_reason = CASE WHEN $1 = 'CANCELLED' THEN 'test' END
			         WHERE order_number = $2`, from, number)

			status, body := move(c, number, to)
			if allowed[name] {
				if status != 200 || orderOf(body)["status"] != to {
					t.Errorf("%s: want allowed, got %d %v", name, status, body)
				}
				continue
			}
			wantStatus, wantCode := http.StatusConflict, "BAD_TRANSITION"
			if to == "PENDING" { // never a target: a form error, whatever the order is
				wantStatus, wantCode = http.StatusUnprocessableEntity, "VALIDATION"
			}
			if status != wantStatus || errorCode(body) != wantCode {
				t.Errorf("%s: want %d %s, got %d %v", name, wantStatus, wantCode, status, body)
			}
			if got := queryString(t, "SELECT status::text FROM orders WHERE order_number = $1", number); got != from {
				t.Errorf("%s: a refused move changed the status to %s", name, got)
			}
		}
	}
}

func TestAdminConfirmShipDeliver(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, token := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 2))
	admin := ownerID(t)

	for _, to := range []string{"CONFIRMED", "SHIPPED", "DELIVERED"} {
		status, body := move(c, number, to)
		if status != 200 || orderOf(body)["status"] != to {
			t.Fatalf("%s: %d %v", to, status, body)
		}
	}
	// Each move has a history row with the admin's id.
	if n := queryInt(t, `SELECT count(*) FROM order_status_history h JOIN orders o ON o.id = h.order_id
	                     WHERE o.order_number = $1 AND h.actor = 'ADMIN' AND h.by_admin_id = $2`, number, admin); n != 3 {
		t.Fatalf("admin history rows = %d, want 3", n)
	}
	// Delivered: the COD payment is collected.
	if got := queryString(t, `SELECT p.status::text FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.order_number = $1`, number); got != "COLLECTED" {
		t.Fatalf("payment = %s", got)
	}
	if n := queryInt(t, `SELECT count(*) FROM payments p JOIN orders o ON o.id = p.order_id
	                     WHERE o.order_number = $1 AND p.collected_at IS NOT NULL`, number); n != 1 {
		t.Fatal("collected_at not set")
	}
	if got := queryString(t, "SELECT courier_name || ' ' || courier_tracking FROM orders WHERE order_number = $1", number); got != "Steadfast SF-4471029" {
		t.Fatalf("courier = %q", got)
	}

	// The buyer's tracking page shows the courier and who did it, but no
	// admin email.
	_, body := do(t, s, "POST", "/api/orders/track", map[string]any{"orderNumber": number, "token": token})
	timeline := orderOf(body)["timeline"].([]any)
	shipped := timeline[2].(map[string]any)
	if len(timeline) != 4 || shipped["by"] != "ADMIN" || !strings.Contains(shipped["note"].(string), "SF-4471029") {
		t.Fatalf("timeline = %v", timeline)
	}
	raw, _ := jsonString(body)
	if strings.Contains(raw, ownerEmail) {
		t.Fatal("the tracking answer shows the admin's email")
	}

	// The admin view: full detail, no more moves.
	status, body := c.do("GET", "/api/admin/orders/"+number, nil)
	o := orderOf(body)
	if status != 200 || len(o["nextMoves"].([]any)) != 0 || o["customer"].(map[string]any)["phone"] != "01712345678" {
		t.Fatalf("detail: %d %v", status, body)
	}
	steps := o["timeline"].([]any)
	if steps[1].(map[string]any)["adminEmail"] != ownerEmail {
		t.Fatalf("timeline admin email: %v", steps[1])
	}
}

func TestAdminCancelPutsStockBackWithAdminID(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	// The last 3 desk drones: the limited product becomes SOLD_OUT.
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "DRN-01"), 3))
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "SOLD_OUT" {
		t.Fatalf("drone = %s", st)
	}
	move(c, number, "CONFIRMED")
	move(c, number, "SHIPPED")

	// Cancel needs a reason.
	status, body := c.do("POST", "/api/admin/orders/"+number+"/status", map[string]any{"to": "CANCELLED", "reason": "  "})
	if status != 422 || body["error"].(map[string]any)["fields"].(map[string]any)["reason"] == nil {
		t.Fatalf("cancel without reason: %d %v", status, body)
	}

	// SHIPPED -> CANCELLED (admin only): stock back, product on sale again.
	status, body = move(c, number, "CANCELLED")
	if status != 200 || orderOf(body)["cancelReason"] != "Cancelled by DRAKON: Customer asked on the phone" {
		t.Fatalf("cancel: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'DRN-01'"); n != 3 {
		t.Fatalf("stock = %d, want 3 back", n)
	}
	if n := queryInt(t, `SELECT count(*) FROM inventory_movements WHERE reason = 'CANCEL' AND change = 3 AND by_admin_id = $1`, admin); n != 1 {
		t.Fatalf("CANCEL movements with admin id = %d", n)
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "ACTIVE" {
		t.Fatalf("drone = %s, want ACTIVE again", st)
	}
	if n := queryInt(t, `SELECT count(*) FROM product_events WHERE type = 'REACTIVATE' AND actor = 'ADMIN' AND by_admin_id = $1`, admin); n != 1 {
		t.Fatalf("REACTIVATE events by the admin = %d", n)
	}
	if n := queryInt(t, `SELECT count(*) FROM order_status_history WHERE to_status = 'CANCELLED' AND from_status = 'SHIPPED' AND by_admin_id = $1`, admin); n != 1 {
		t.Fatal("no cancel history row with the admin id")
	}
	// Cancelling twice is refused and does not add stock again.
	if status, _ := move(c, number, "CANCELLED"); status != http.StatusConflict {
		t.Fatalf("second cancel: %d", status)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'DRN-01'"); n != 3 {
		t.Fatalf("stock after second cancel = %d", n)
	}
}

func TestAdminMoveValidation(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))
	move(c, number, "CONFIRMED")

	status, body := c.do("POST", "/api/admin/orders/"+number+"/status", map[string]any{"to": "SHIPPED", "courierName": "Pathao"})
	if status != 422 || body["error"].(map[string]any)["fields"].(map[string]any)["trackingCode"] == nil {
		t.Fatalf("ship without tracking: %d %v", status, body)
	}
	if status, body := c.do("POST", "/api/admin/orders/"+number+"/status", map[string]any{"to": "PENDING"}); status != 422 {
		t.Fatalf("to PENDING: %d %v", status, body)
	}
	if status, body := c.do("POST", "/api/admin/orders/"+number+"/status", map[string]any{"to": "SHIPPED", "price": 1}); status != 400 || errorCode(body) != "UNKNOWN_FIELD" {
		t.Fatalf("unknown field: %d %v", status, body)
	}
	for _, bad := range []string{"DRK-ZZZZZZ", "nonsense", "drk-zzzzzz"} {
		if status, body := c.do("GET", "/api/admin/orders/"+bad, nil); status != 404 || errorCode(body) != "ORDER_NOT_FOUND" {
			t.Fatalf("%s: %d %v", bad, status, body)
		}
	}
	// Lower-case number works too.
	if status, _ := c.do("GET", "/api/admin/orders/"+strings.ToLower(number), nil); status != 200 {
		t.Fatalf("lower-case: %d", status)
	}
}

func TestAdminCannotConfirmAnExpiredOrder(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))
	exec(t, "UPDATE orders SET created_at = now() - interval '49 hours' WHERE order_number = $1", number)

	// The sweep runs first and cancels it, so confirming is refused.
	status, body := move(c, number, "CONFIRMED")
	if status != http.StatusConflict || errorCode(body) != "BAD_TRANSITION" {
		t.Fatalf("confirm an expired order: %d %v", status, body)
	}
	if got := queryString(t, "SELECT status::text FROM orders WHERE order_number = $1", number); got != "CANCELLED" {
		t.Fatalf("status = %s", got)
	}
}

func TestAdminDashboardAndLists(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	ball := variantID(t, "BALL-5")
	older, _ := placeTestOrder(t, s, "01711111111", line(ball, 1))
	exec(t, "UPDATE orders SET created_at = now() - interval '40 hours' WHERE order_number = $1", older)
	newer, _ := placeTestOrder(t, s, "01822222222", line(ball, 2))
	delivered, _ := placeTestOrder(t, s, "01933333333", line(variantID(t, "SLV-100"), 1))
	for _, to := range []string{"CONFIRMED", "SHIPPED", "DELIVERED"} {
		move(c, delivered, to)
	}

	status, body := c.do("GET", "/api/admin/dashboard", nil)
	counts := body["counts"].(map[string]any)
	if status != 200 || num(counts["PENDING"]) != 2 || num(counts["DELIVERED"]) != 1 || num(counts["CANCELLED"]) != 0 {
		t.Fatalf("dashboard: %d %v", status, body)
	}
	// Sleeves 350 + delivery 60 = 410 taka = 41000 paisa.
	for _, key := range []string{"deliveredToday", "deliveredLast7Days"} {
		if m := body[key].(map[string]any); num(m["orders"]) != 1 || num(m["totalPaisa"]) != 41000 {
			t.Fatalf("%s = %v", key, m)
		}
	}

	// Call list: oldest first, with the time left.
	_, body = c.do("GET", "/api/admin/orders/call-list", nil)
	list := body["orders"].([]any)
	if len(list) != 2 || list[0].(map[string]any)["orderNumber"] != older || list[1].(map[string]any)["orderNumber"] != newer {
		t.Fatalf("call list = %v", list)
	}
	if left := num(list[0].(map[string]any)["minutesLeft"]); left < 7*60 || left > 8*60 {
		t.Fatalf("minutesLeft = %v, want about 8 hours", left)
	}

	// The list: filter by status, search by phone in any format, by number and by name.
	for query, want := range map[string]int{
		"":                         3,
		"?status=PENDING":          2,
		"?status=delivered":        1,
		"?q=%2B880%201822-222222":  1, // "+880 1822-222222"
		"?q=" + newer[4:]:          1,
		"?q=nusrat":                3,
		"?q=nobody":                0,
		"?status=SHIPPED&q=nusrat": 0,
	} {
		status, body := c.do("GET", "/api/admin/orders"+query, nil)
		if status != 200 || int(num(body["total"])) != want || len(body["orders"].([]any)) != want {
			t.Errorf("orders%s: %d total=%v", query, status, body["total"])
		}
	}
	if status, _ := c.do("GET", "/api/admin/orders?status=LOST", nil); status != 400 {
		t.Fatalf("bad status: %d", status)
	}
}

func TestAdminOrderNoteAndPhoneHistory(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	ball := variantID(t, "BALL-5")
	first, _ := placeTestOrder(t, s, "01712345678", line(ball, 1))
	move(c, first, "CANCELLED")
	second, _ := placeTestOrder(t, s, "01712345678", line(ball, 1))

	status, body := c.do("PUT", "/api/admin/orders/"+second+"/note", map[string]any{"note": "  Wants evening delivery  "})
	o := orderOf(body)
	if status != 200 || o["adminNote"] != "Wants evening delivery" {
		t.Fatalf("note: %d %v", status, body)
	}
	if h := o["phoneHistory"].(map[string]any); num(h["CANCELLED"]) != 1 || len(h) != 1 {
		t.Fatalf("phoneHistory = %v", h)
	}
	// The note is never in the buyer's view.
	_, track := do(t, s, "POST", "/api/orders/track", map[string]any{"orderNumber": second, "phone": "01712345678"})
	if raw, _ := jsonString(track); strings.Contains(raw, "evening") {
		t.Fatal("the buyer can see the internal note")
	}
	if status, _ := c.do("PUT", "/api/admin/orders/"+second+"/note", map[string]any{"note": strings.Repeat("x", 2001)}); status != 422 {
		t.Fatalf("long note: %d", status)
	}
}

func TestAdminBlockAndUnblockPhone(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	ball := variantID(t, "BALL-5")

	if status, _ := c.do("POST", "/api/admin/blocked-phones", map[string]any{"phone": "01712345678", "reason": ""}); status != 422 {
		t.Fatalf("no reason: %d", status)
	}
	if status, _ := c.do("POST", "/api/admin/blocked-phones", map[string]any{"phone": "12345", "reason": "x"}); status != 422 {
		t.Fatalf("bad phone: %d", status)
	}
	status, body := c.do("POST", "/api/admin/blocked-phones", map[string]any{"phone": "+880 1712-345678", "reason": "Refused 3 orders"})
	phones := body["phones"].([]any)
	if status != 200 || len(phones) != 1 || phones[0].(map[string]any)["phone"] != "01712345678" || phones[0].(map[string]any)["blockedBy"] != ownerEmail {
		t.Fatalf("block: %d %v", status, body)
	}
	if status, body := do(t, s, "POST", "/api/orders", orderBody(t, "01712345678", line(ball, 1))); status != 403 || errorCode(body) != "PHONE_BLOCKED" {
		t.Fatalf("order from a blocked phone: %d %v", status, body)
	}

	status, body = c.do("POST", "/api/admin/blocked-phones/unblock", map[string]any{"phone": "01712345678"})
	if status != 200 || len(body["phones"].([]any)) != 0 {
		t.Fatalf("unblock: %d %v", status, body)
	}
	if status, _ := c.do("POST", "/api/admin/blocked-phones/unblock", map[string]any{"phone": "01712345678"}); status != 404 {
		t.Fatalf("unblock again: %d", status)
	}
	placeTestOrder(t, s, "01712345678", line(ball, 1))
}

// Personal data (name, phone, address) must never reach the server log,
// not even when a request fails.
func TestAdminPersonalDataStaysOutOfTheLog(t *testing.T) {
	s := newTestServer(t, true)
	var logs bytes.Buffer
	s.log = slog.New(slog.NewTextHandler(io.MultiWriter(&logs), nil))
	c := loginOwner(t, s)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))
	c.do("GET", "/api/admin/orders?q=01712345678", nil)
	c.do("GET", "/api/admin/orders/"+number, nil)
	c.do("POST", "/api/admin/blocked-phones", map[string]any{"phone": "01712345678", "reason": "test"})
	c.do("POST", "/api/admin/blocked-phones/unblock", map[string]any{"phone": "01712345678"})
	move(c, number, "SHIPPED") // refused: still PENDING

	for _, private := range []string{"01712345678", "Nusrat", "Mirpur", "House 12", ownerPassword} {
		if strings.Contains(logs.String(), private) {
			t.Fatalf("the log contains %q:\n%s", private, logs.String())
		}
	}
	if !strings.Contains(logs.String(), "/api/admin/orders") {
		t.Fatal("the test logger caught nothing; the check above proves nothing")
	}
}

func jsonString(v any) (string, error) {
	var b strings.Builder
	_, err := fmt.Fprintf(&b, "%v", v)
	return b.String(), err
}
