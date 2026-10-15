package httpapi

import (
	"context"
	"net/http"
	"testing"
)

// variantID looks up a seeded variant by its SKU.
func variantID(t *testing.T, sku string) int64 {
	t.Helper()
	var id int64
	if err := testDB.Pool.QueryRow(context.Background(), "SELECT id FROM product_variants WHERE sku = $1", sku).Scan(&id); err != nil {
		t.Fatalf("variant %s: %v", sku, err)
	}
	return id
}

// areaID looks up a delivery area by district and label.
func areaID(t *testing.T, district, label string) int64 {
	t.Helper()
	var id int64
	if err := testDB.Pool.QueryRow(context.Background(), "SELECT id FROM delivery_areas WHERE district = $1 AND area_label = $2", district, label).Scan(&id); err != nil {
		t.Fatalf("area %s/%s: %v", district, label, err)
	}
	return id
}

func exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := testDB.Pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func num(v any) float64 { f, _ := v.(float64); return f }

func problemCodes(body map[string]any) []string {
	out := []string{}
	for _, p := range list(body, "problems") {
		out = append(out, p.(map[string]any)["code"].(string))
	}
	return out
}

func TestQuotePricesFromDatabase(t *testing.T) {
	s := newTestServer(t, true)
	metal := variantID(t, "DF01-METAL") // ৳1,490
	ball := variantID(t, "BALL-5")      // ৳1,800
	status, body := do(t, s, http.MethodPost, "/api/checkout/quote", map[string]any{
		"items":          []map[string]any{{"variantId": metal, "qty": 1}, {"variantId": ball, "qty": 2}},
		"deliveryAreaId": areaID(t, "Dhaka", "Dhaka city"),
	})
	if status != 200 {
		t.Fatalf("status %d %v", status, body)
	}
	if num(body["subtotalPaisa"]) != 149000+2*180000 {
		t.Errorf("subtotal = %v", body["subtotalPaisa"])
	}
	d := body["delivery"].(map[string]any)
	if d["zoneCode"] != "INSIDE_DHAKA" || num(d["chargePaisa"]) != 6000 {
		t.Errorf("delivery = %v", d)
	}
	if num(body["totalPaisa"]) != 149000+360000+6000 || len(list(body, "problems")) != 0 {
		t.Errorf("total = %v problems = %v", body["totalPaisa"], body["problems"])
	}
	first := list(body, "items")[0].(map[string]any)
	if first["variantName"] != "Metal" || first["productSlug"] != "dragon-flame-card-edition-01" || first["thumb"] != "/img/t-c-df-metal.webp" || num(first["maxQty"]) != 2 {
		t.Errorf("item = %v", first)
	}
}

func TestQuoteWithoutAreaHasNoTotal(t *testing.T) {
	s := newTestServer(t, true)
	status, body := do(t, s, http.MethodPost, "/api/checkout/quote", map[string]any{
		"items": []map[string]any{{"variantId": variantID(t, "HD02-M"), "qty": 1}},
	})
	if status != 200 || body["delivery"] != nil || body["totalPaisa"] != nil {
		t.Fatalf("got %d %v", status, body)
	}
	if list(body, "items")[0].(map[string]any)["variantName"] != "Size M" {
		t.Errorf("variant name: %v", body["items"])
	}
}

func TestQuoteOutsideDhakaAndFreeDelivery(t *testing.T) {
	s := newTestServer(t, true)
	req := map[string]any{
		"items":          []map[string]any{{"variantId": variantID(t, "BALL-5"), "qty": 1}},
		"deliveryAreaId": areaID(t, "Sylhet", "Sylhet"),
	}
	_, body := do(t, s, http.MethodPost, "/api/checkout/quote", req)
	if num(body["delivery"].(map[string]any)["chargePaisa"]) != 10000 {
		t.Fatalf("outside Dhaka: %v", body["delivery"])
	}

	// Free over ৳1,500 is set, but the setting is off: still charged.
	exec(t, "UPDATE delivery_zones SET free_over_paisa = 150000 WHERE code = 'OUTSIDE_DHAKA'")
	_, body = do(t, s, http.MethodPost, "/api/checkout/quote", req)
	if num(body["delivery"].(map[string]any)["chargePaisa"]) != 10000 {
		t.Fatalf("setting off: %v", body["delivery"])
	}
	// Setting on: free.
	exec(t, "UPDATE settings SET value = 'true' WHERE key = 'free_delivery_enabled'")
	_, body = do(t, s, http.MethodPost, "/api/checkout/quote", req)
	d := body["delivery"].(map[string]any)
	if num(d["chargePaisa"]) != 0 || d["freeDelivery"] != true || num(body["totalPaisa"]) != 180000 {
		t.Fatalf("free delivery: %v total %v", d, body["totalPaisa"])
	}
}

func TestQuoteProblems(t *testing.T) {
	s := newTestServer(t, true)
	status, body := do(t, s, http.MethodPost, "/api/checkout/quote", map[string]any{"items": []map[string]any{
		{"variantId": variantID(t, "DF01-PKEY"), "qty": 1}, // stock 0
		{"variantId": variantID(t, "DRN-01"), "qty": 4},    // only 3 left
		{"variantId": variantID(t, "FND-STD"), "qty": 1},   // sold out run
		{"variantId": variantID(t, "HD02-S"), "qty": 2},    // hoodie limit 2: S + M = 3
		{"variantId": variantID(t, "HD02-M"), "qty": 1},
		{"variantId": 999999, "qty": 1}, // unknown
	}})
	if status != 200 {
		t.Fatalf("status %d", status)
	}
	got := problemCodes(body)
	// Problems follow the cart order.
	want := []string{"OUT_OF_STOCK", "NOT_ENOUGH_STOCK", "UNAVAILABLE", "OVER_LIMIT", "OVER_LIMIT", "UNKNOWN_VARIANT"}
	if !equalStrings(got, want) {
		t.Fatalf("problems = %v, want %v", got, want)
	}
	if len(list(body, "items")) != 5 {
		t.Errorf("items: %d", len(list(body, "items")))
	}
}

func TestQuoteMergesRepeatedLines(t *testing.T) {
	s := newTestServer(t, true)
	id := variantID(t, "SLV-100")
	_, body := do(t, s, http.MethodPost, "/api/checkout/quote", map[string]any{"items": []map[string]any{{"variantId": id, "qty": 2}, {"variantId": id, "qty": 1}}})
	items := list(body, "items")
	if len(items) != 1 || num(items[0].(map[string]any)["qty"]) != 3 {
		t.Fatalf("items = %v", items)
	}
}

func TestQuoteRejectsBadInput(t *testing.T) {
	s := newTestServer(t, true)
	cases := []struct {
		body any
		code string
	}{
		{map[string]any{"items": []any{}}, "EMPTY_CART"},
		{map[string]any{"items": []map[string]any{{"variantId": 1, "qty": 0}}}, "BAD_CART"},
		{map[string]any{"items": []map[string]any{{"variantId": 1, "qty": 100}}}, "BAD_CART"},
		{map[string]any{"items": []map[string]any{{"variantId": 1, "qty": 1, "pricePaisa": 1}}}, "UNKNOWN_FIELD"},
		{map[string]any{"items": []map[string]any{{"variantId": 1, "qty": 1}}, "deliveryAreaId": 999999}, "UNKNOWN_AREA"},
	}
	for _, tc := range cases {
		status, body := do(t, s, http.MethodPost, "/api/checkout/quote", tc.body)
		if errorCode(body) != tc.code || status < 400 {
			t.Errorf("%v: got %d %v, want %s", tc.body, status, body, tc.code)
		}
	}
}
