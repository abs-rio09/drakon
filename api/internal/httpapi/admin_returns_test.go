package httpapi

import (
	"net/http"
	"testing"
)

// deliveredOrder places an order and moves it to DELIVERED. It returns the
// order number and the order line ids (in order).
func deliveredOrder(t *testing.T, s *Server, c *adminClient, phone string, lines ...map[string]any) (string, []int64) {
	t.Helper()
	number, _ := placeTestOrder(t, s, phone, lines...)
	for _, to := range []string{"CONFIRMED", "SHIPPED", "DELIVERED"} {
		if status, body := move(c, number, to); status != 200 {
			t.Fatalf("%s: %d %v", to, status, body)
		}
	}
	_, body := c.do("GET", "/api/admin/orders/"+number, nil)
	ids := []int64{}
	for _, it := range orderOf(body)["items"].([]any) {
		ids = append(ids, int64(num(it.(map[string]any)["id"])))
	}
	return number, ids
}

func returnBody(items []map[string]any, refund int64) map[string]any {
	b := map[string]any{
		"reasonType": "COMPANY_FAULT", "note": "Arrived with a torn seam", "deliveryPaidBy": "COMPANY",
		"refundPaisa": refund, "refundMethod": "BKASH", "refundRef": "BK8XQ2P1", "items": items,
	}
	if refund == 0 {
		b["refundMethod"], b["refundRef"] = "", ""
	}
	return b
}

func back(id int64, qty int, resellable bool) map[string]any {
	return map[string]any{"orderItemId": id, "qty": qty, "resellable": resellable}
}

func TestAdminReturnOnlyForDelivered(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, _ := placeTestOrder(t, s, "01712345678", line(variantID(t, "BALL-5"), 1))
	item := int64(queryInt(t, "SELECT i.id FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.order_number = $1", number))
	status, body := c.do("POST", "/api/admin/orders/"+number+"/returns", returnBody([]map[string]any{back(item, 1, true)}, 0))
	if status != http.StatusConflict || errorCode(body) != "NOT_DELIVERED" {
		t.Fatalf("return of a PENDING order: %d %v", status, body)
	}
}

func TestAdminReturnsStockRefundAndPayment(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	ball := variantID(t, "BALL-5") // ৳1,800, stock 20
	number, items := deliveredOrder(t, s, c, "01712345678", line(ball, 2))
	path := "/api/admin/orders/" + number + "/returns"
	// Paid: 2 × 1800 + 60 delivery = 3660 taka.

	// 1. One ball back and sellable, ৳1,800 refunded by bKash.
	status, body := c.do("POST", path, returnBody([]map[string]any{back(items[0], 1, true)}, 180000))
	if status != 200 {
		t.Fatalf("first return: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball); n != 19 {
		t.Fatalf("stock = %d, want 19 (18 + 1 back)", n)
	}
	if n := queryInt(t, `SELECT count(*) FROM inventory_movements m JOIN orders o ON o.id = m.order_id
	                     WHERE o.order_number = $1 AND m.reason = 'RETURN' AND m.change = 1 AND m.by_admin_id = $2`, number, admin); n != 1 {
		t.Fatal("no RETURN movement with the admin id and the order")
	}
	if got := queryString(t, "SELECT p.status::text FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.order_number = $1", number); got != "COLLECTED" {
		t.Fatalf("payment after a partial refund = %s", got)
	}
	o := orderOf(body)
	if num(o["refundedPaisa"]) != 180000 || num(o["items"].([]any)[0].(map[string]any)["returnedQty"]) != 1 || o["returnUntil"] == nil {
		t.Fatalf("order after return = %v", o)
	}
	rets := body["returns"].([]any)
	if len(rets) != 1 || rets[0].(map[string]any)["adminEmail"] != ownerEmail || rets[0].(map[string]any)["refundMethod"] != "BKASH" {
		t.Fatalf("returns = %v", rets)
	}

	// 2. Too many pieces, and too much money.
	if status, body := c.do("POST", path, returnBody([]map[string]any{back(items[0], 2, true)}, 0)); status != 409 || errorCode(body) != "TOO_MANY_PIECES" {
		t.Fatalf("too many: %d %v", status, body)
	}
	if status, body := c.do("POST", path, returnBody([]map[string]any{back(items[0], 1, false)}, 186001)); status != 409 || errorCode(body) != "REFUND_TOO_HIGH" {
		t.Fatalf("refund too high: %d %v", status, body)
	}

	// 3. The second ball is broken (not sellable), the rest is refunded in cash: fully refunded.
	b := returnBody([]map[string]any{back(items[0], 1, false)}, 186000)
	b["refundMethod"], b["refundRef"] = "CASH", ""
	if status, body := c.do("POST", path, b); status != 200 {
		t.Fatalf("second return: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", ball); n != 19 {
		t.Fatalf("a broken piece went back to stock: %d", n)
	}
	if got := queryString(t, "SELECT p.status::text FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.order_number = $1", number); got != "REFUNDED" {
		t.Fatalf("payment after the full refund = %s", got)
	}
	if n := queryInt(t, "SELECT count(*) FROM returns r JOIN orders o ON o.id = r.order_id WHERE o.order_number = $1 AND r.by_admin_id = $2", number, admin); n != 2 {
		t.Fatalf("returns with the admin id = %d", n)
	}
	// The order itself stays DELIVERED (orders never change after the fact).
	if got := queryString(t, "SELECT status::text FROM orders WHERE order_number = $1", number); got != "DELIVERED" {
		t.Fatalf("order status = %s", got)
	}
}

func TestAdminReturnWindowAndValidation(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, items := deliveredOrder(t, s, c, "01712345678", line(variantID(t, "SLV-100"), 1))
	path := "/api/admin/orders/" + number + "/returns"
	ok := []map[string]any{back(items[0], 1, true)}

	for name, change := range map[string]map[string]any{
		"deliveryPaidBy":   {"deliveryPaidBy": "CUSTOMER"}, // our fault, but the customer pays: not the policy
		"conditionChecked": {"reasonType": "OTHER", "deliveryPaidBy": "CUSTOMER"},
		"reasonType":       {"reasonType": "CHANGED_MIND"},
		"refundMethod":     {"refundMethod": ""},
		"refundRef":        {"refundRef": ""},
		"note":             {"note": "x"},
		"items":            {"items": []map[string]any{}},
	} {
		b := returnBody(ok, 35000)
		for k, v := range change {
			b[k] = v
		}
		status, body := c.do("POST", path, b)
		if status != 422 || fieldError(body, name) == "" {
			t.Errorf("%s: %d %v", name, status, body)
		}
	}
	other, otherItems := deliveredOrder(t, s, c, "01812345678", line(variantID(t, "BALL-5"), 1))
	_ = other
	if status, body := c.do("POST", path, returnBody([]map[string]any{back(otherItems[0], 1, true)}, 0)); status != 422 || fieldError(body, "items") == "" {
		t.Fatalf("a line of another order: %d %v", status, body)
	}

	// "Other reason" with the condition checked and the customer paying delivery: fine.
	b := returnBody(ok, 35000)
	b["reasonType"], b["deliveryPaidBy"], b["conditionChecked"] = "OTHER", "CUSTOMER", true
	b["refundMethod"], b["refundRef"] = "NAGAD", "NG-11902"
	if status, body := c.do("POST", path, b); status != 200 {
		t.Fatalf("other reason: %d %v", status, body)
	}

	// The window: delivered 4 days ago with return_days = 3 -> closed.
	exec(t, "UPDATE orders SET delivered_at = now() - interval '4 days' WHERE order_number = $1", other)
	if status, body := c.do("POST", "/api/admin/orders/"+other+"/returns", returnBody([]map[string]any{back(otherItems[0], 1, true)}, 0)); status != 409 || errorCode(body) != "RETURN_WINDOW_OVER" {
		t.Fatalf("after the window: %d %v", status, body)
	}
	// With return_days = 7 (a setting) it is open again.
	exec(t, "UPDATE settings SET value = '7' WHERE key = 'return_days'")
	if status, body := c.do("POST", "/api/admin/orders/"+other+"/returns", returnBody([]map[string]any{back(otherItems[0], 1, true)}, 0)); status != 200 {
		t.Fatalf("inside a 7-day window: %d %v", status, body)
	}
}

func TestAdminReturnBringsSoldOutBack(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	number, items := deliveredOrder(t, s, c, "01712345678", line(variantID(t, "DRN-01"), 3)) // the last 3 drones
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "SOLD_OUT" {
		t.Fatalf("drone = %s", st)
	}
	if status, body := c.do("POST", "/api/admin/orders/"+number+"/returns", returnBody([]map[string]any{back(items[0], 1, true)}, 0)); status != 200 {
		t.Fatalf("return: %d %v", status, body)
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "ACTIVE" {
		t.Fatalf("drone = %s, want ACTIVE again (blueprint rule 9)", st)
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'REACTIVATE' AND reason = 'Stock came back from a return' AND by_admin_id = $1", admin); n != 1 {
		t.Fatal("no REACTIVATE event for the return")
	}
}

// A huge refund after an earlier one must not wrap around int64 and slip
// past "never more than was paid".
func TestAdminRefundCannotOverflow(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	number, items := deliveredOrder(t, s, c, "01712345678", line(variantID(t, "BALL-5"), 2))
	path := "/api/admin/orders/" + number + "/returns"
	if status, body := c.do("POST", path, returnBody([]map[string]any{back(items[0], 1, true)}, 1000)); status != 200 {
		t.Fatalf("first return: %d %v", status, body)
	}
	const maxInt64 = int64(^uint64(0) >> 1)
	status, body := c.do("POST", path, returnBody([]map[string]any{back(items[0], 1, false)}, maxInt64-500))
	if status != http.StatusConflict || errorCode(body) != "REFUND_TOO_HIGH" {
		t.Fatalf("huge refund: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT count(*) FROM returns r JOIN orders o ON o.id = r.order_id WHERE o.order_number = $1", number); n != 1 {
		t.Fatalf("returns saved = %d, want only the first", n)
	}
}
