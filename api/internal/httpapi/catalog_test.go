package httpapi

import (
	"context"
	"net/http"
	"testing"
)

func list(body map[string]any, key string) []any {
	v, _ := body[key].([]any)
	return v
}

func slugs(items []any) []string {
	out := []string{}
	for _, it := range items {
		m, _ := it.(map[string]any)
		s, _ := m["slug"].(string)
		out = append(out, s)
	}
	return out
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestCategories(t *testing.T) {
	s := newTestServer(t, true)
	status, body := do(t, s, http.MethodGet, "/api/categories", nil)
	got := slugs(list(body, "categories"))
	want := []string{"playcards", "sports-toys", "tech-toys", "clothes"}
	if status != 200 || !equalStrings(got, want) {
		t.Fatalf("got %d %v", status, got)
	}
}

func TestProductsListsOnlyActiveInShopOrder(t *testing.T) {
	s := newTestServer(t, true)
	status, body := do(t, s, http.MethodGet, "/api/products", nil)
	want := []string{
		"dragon-flame-card-edition-01", "ember-night-hoodie-edition-02", "midnight-circuit-desk-drone",
		"night-striker-football", "dragon-flame-playcard-set", "card-sleeves-ember-100", "ember-logo-tee-black",
	}
	if got := slugs(list(body, "products")); status != 200 || !equalStrings(got, want) {
		t.Fatalf("got %d %v", status, got)
	}
	if body["total"].(float64) != 7 {
		t.Fatalf("total = %v", body["total"])
	}
}

func TestProductsFilterSearchAndPaging(t *testing.T) {
	s := newTestServer(t, true)
	cases := []struct {
		path string
		want []string
	}{
		{"/api/products?category=clothes", []string{"ember-night-hoodie-edition-02", "ember-logo-tee-black"}},
		{"/api/products?q=HOODIE", []string{"ember-night-hoodie-edition-02"}},   // case-insensitive, not the archived Edition 01
		{"/api/products?q=tech%20toy", []string{"midnight-circuit-desk-drone"}}, // matches kind
		{"/api/products?q=100%25", []string{}},                                  // "100%": % is literal, not a wildcard
		{"/api/products?q=_", []string{}},                                       // _ is literal too
		{"/api/products?category=nope", []string{}},
		{"/api/products?limit=2&offset=1", []string{"ember-night-hoodie-edition-02", "midnight-circuit-desk-drone"}},
		{"/api/products?offset=50", []string{}},
	}
	for _, tc := range cases {
		status, body := do(t, s, http.MethodGet, tc.path, nil)
		if got := slugs(list(body, "products")); status != 200 || !equalStrings(got, tc.want) {
			t.Errorf("%s: got %d %v, want %v", tc.path, status, got, tc.want)
		}
	}
	_, body := do(t, s, http.MethodGet, "/api/products?limit=2&offset=1", nil)
	if body["total"].(float64) != 7 {
		t.Errorf("total with paging = %v, want 7", body["total"])
	}
	// Search: total counts every match, not only the page (the web shows
	// "Showing 1 of N", open question 24).
	all := len(list(must(do(t, s, http.MethodGet, "/api/products?q=e&limit=100", nil)), "products"))
	_, body = do(t, s, http.MethodGet, "/api/products?q=e&limit=1", nil)
	if all < 2 || len(list(body, "products")) != 1 || int(body["total"].(float64)) != all {
		t.Errorf("search total = %v with 1 shown, want %d", body["total"], all)
	}
}

// must drops the status of do (for a request that is known to work).
func must(_ int, body map[string]any) map[string]any { return body }

func TestProductsRejectsBadPaging(t *testing.T) {
	s := newTestServer(t, true)
	for _, path := range []string{"/api/products?limit=0", "/api/products?limit=101", "/api/products?limit=x", "/api/products?offset=-1"} {
		status, body := do(t, s, http.MethodGet, path, nil)
		if status != http.StatusBadRequest || errorCode(body) != "BAD_QUERY" {
			t.Errorf("%s: got %d %v", path, status, body)
		}
	}
}

func TestProductDetails(t *testing.T) {
	s := newTestServer(t, true)
	status, body := do(t, s, http.MethodGet, "/api/products/dragon-flame-card-edition-01", nil)
	if status != 200 {
		t.Fatalf("status %d", status)
	}
	p := body["product"].(map[string]any)
	if p["name"] != "Dragon Flame Card · Edition 01" || p["kind"] != "Collectible card" || p["variantKind"] != "Material" ||
		p["editionSize"].(float64) != 100 || p["purchaseLimit"].(float64) != 2 || p["categorySlug"] != "playcards" {
		t.Fatalf("product fields: %v", p)
	}
	if len(p["story"].([]any)) != 2 || len(p["details"].([]any)) != 5 || len(p["images"].([]any)) != 5 {
		t.Fatalf("story/details/images: %v", p)
	}
	variants := p["variants"].([]any)
	first := variants[0].(map[string]any)
	if len(variants) != 5 || first["sku"] != "DF01-PAPER" || first["pricePaisa"].(float64) != 45000 ||
		first["note"] != "Thick matte card stock" || first["imageIndex"].(float64) != 1 {
		t.Fatalf("variants: %v", variants)
	}
	img := p["images"].([]any)[1].(map[string]any)
	if img["thumb"] != "/img/t-c-df-paper.webp" || img["name"] != "Hard paper" {
		t.Fatalf("image: %v", img)
	}
	related := slugs(list(body, "related"))
	if len(related) != 4 || related[0] != "dragon-flame-playcard-set" || related[1] != "card-sleeves-ember-100" {
		t.Fatalf("related: %v", related)
	}
}

func TestDraftAndUnknownProductsAre404(t *testing.T) {
	s := newTestServer(t, true)
	if _, err := testDB.Pool.Exec(context.Background(), "UPDATE products SET status = 'DRAFT' WHERE slug = 'night-striker-football'"); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/api/products/night-striker-football", "/api/products/no-such-thing"} {
		status, body := do(t, s, http.MethodGet, path, nil)
		if status != http.StatusNotFound || errorCode(body) != "NOT_FOUND" {
			t.Errorf("%s: got %d %v", path, status, body)
		}
	}
	_, body := do(t, s, http.MethodGet, "/api/products?q=striker", nil)
	if len(list(body, "products")) != 0 {
		t.Error("a DRAFT product appeared in the shop")
	}
}

func TestFeaturedAndHero(t *testing.T) {
	s := newTestServer(t, true)
	status, body := do(t, s, http.MethodGet, "/api/products/featured", nil)
	want := []string{"dragon-flame-card-edition-01", "ember-night-hoodie-edition-02", "midnight-circuit-desk-drone", "night-striker-football"}
	if got := slugs(list(body, "products")); status != 200 || !equalStrings(got, want) {
		t.Fatalf("featured: %d %v", status, got)
	}
	hero, _ := body["hero"].(map[string]any)
	if hero["slug"] != "dragon-flame-playcard-set" {
		t.Fatalf("hero: %v", body["hero"])
	}
}

func TestSoldOutArchive(t *testing.T) {
	s := newTestServer(t, true)
	status, body := do(t, s, http.MethodGet, "/api/sold-out", nil)
	want := []string{"ember-night-hoodie-edition-01", "founders-playcard-deck", "glow-arena-mini-goal"}
	items := list(body, "products")
	if got := slugs(items); status != 200 || !equalStrings(got, want) {
		t.Fatalf("archive: %d %v", status, got)
	}
	first := items[0].(map[string]any)
	if first["successorSlug"] != "ember-night-hoodie-edition-02" || first["status"] != "ARCHIVED" || first["soldOutAt"] == nil {
		t.Fatalf("archive item: %v", first)
	}
}

func TestDeliveryAreas(t *testing.T) {
	s := newTestServer(t, false)
	status, body := do(t, s, http.MethodGet, "/api/delivery/areas", nil)
	districts := list(body, "districts")
	if status != 200 || len(districts) != 64 {
		t.Fatalf("got %d, %d districts", status, len(districts))
	}
	zones := list(body, "zones")
	if len(zones) != 2 || zones[0].(map[string]any)["chargePaisa"].(float64) != 6000 || zones[1].(map[string]any)["chargePaisa"].(float64) != 10000 {
		t.Fatalf("zones: %v", zones)
	}
	if body["freeDeliveryEnabled"] != false {
		t.Fatalf("freeDeliveryEnabled: %v", body["freeDeliveryEnabled"])
	}
	for _, d := range districts {
		m := d.(map[string]any)
		areas := m["areas"].([]any)
		if m["name"] == "Dhaka" {
			if len(areas) != 2 || areas[0].(map[string]any)["zoneCode"] != "INSIDE_DHAKA" || areas[1].(map[string]any)["zoneCode"] != "OUTSIDE_DHAKA" {
				t.Fatalf("Dhaka areas: %v", areas)
			}
		} else if len(areas) != 1 || areas[0].(map[string]any)["zoneCode"] != "OUTSIDE_DHAKA" {
			t.Fatalf("%v areas: %v", m["name"], areas)
		}
	}
}

func TestPublicSettings(t *testing.T) {
	s := newTestServer(t, false)
	status, body := do(t, s, http.MethodGet, "/api/settings/public", nil)
	want := map[string]float64{"codConfirmHours": 48, "defaultPurchaseLimit": 5, "returnDays": 3, "lowStockThreshold": 5, "giftNoteMaxChars": 150, "courierNoteMaxChars": 200}
	if status != 200 {
		t.Fatalf("status %d", status)
	}
	for k, v := range want {
		if body[k] != v {
			t.Errorf("%s = %v, want %v", k, body[k], v)
		}
	}
	if _, leaked := body["archiveAfterDays"]; leaked {
		t.Error("archiveAfterDays is not needed by the website")
	}
}

func TestMissingSettingIsAnError(t *testing.T) {
	s := newTestServer(t, false)
	if _, err := testDB.Pool.Exec(context.Background(), "DELETE FROM settings WHERE key = 'return_days'"); err != nil {
		t.Fatal(err)
	}
	status, body := do(t, s, http.MethodGet, "/api/settings/public", nil)
	if status != http.StatusInternalServerError || errorCode(body) != "INTERNAL" {
		t.Fatalf("got %d %v", status, body)
	}
}

// The shop names a variant "<kind> <label>" ("Size M"), so a sample label
// must not repeat the kind, or buyers read "Size Size 5".
func TestSeedVariantLabelsDoNotRepeatTheKind(t *testing.T) {
	newTestServer(t, true)
	if n := queryInt(t, `SELECT count(*) FROM product_variants v JOIN products p ON p.id = v.product_id
	                     WHERE lower(v.label) LIKE lower(p.variant_kind) || ' %'`); n != 0 {
		t.Fatalf("%d sample variants repeat their kind in the label", n)
	}
}
