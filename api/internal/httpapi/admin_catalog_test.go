package httpapi

import (
	"fmt"
	"net/http"
	"testing"
)

func categorySlugs(t *testing.T, s *Server) []string {
	t.Helper()
	_, body := do(t, s, "GET", "/api/categories", nil)
	out := []string{}
	for _, c := range body["categories"].([]any) {
		out = append(out, c.(map[string]any)["slug"].(string))
	}
	return out
}

func TestAdminCategories(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)

	status, body := c.do("POST", "/api/admin/categories", map[string]any{"name": "Board Games", "image": "/img/cat-tech.webp"})
	cats := body["categories"].([]any)
	last := cats[len(cats)-1].(map[string]any)
	if status != 200 || last["slug"] != "board-games" || num(last["productCount"]) != 0 || last["isActive"] != true {
		t.Fatalf("create: %d %v", status, body)
	}
	if status, body := c.do("POST", "/api/admin/categories", map[string]any{"name": "Board games"}); status != 422 || fieldError(body, "slug") == "" {
		t.Fatalf("duplicate slug: %d %v", status, body)
	}
	if status, body := c.do("POST", "/api/admin/categories", map[string]any{"name": "X"}); status != 422 || fieldError(body, "name") == "" {
		t.Fatalf("short name: %d %v", status, body)
	}
	if got := categorySlugs(t, s); len(got) != 5 || got[4] != "board-games" {
		t.Fatalf("shop categories = %v", got)
	}

	// Rename and turn off a category that has products: allowed, and it
	// leaves the shop menu at once. Its products are kept.
	clothes := int64(queryInt(t, "SELECT id FROM categories WHERE slug = 'clothes'"))
	path := fmt.Sprintf("/api/admin/categories/%d", clothes)
	if status, body := c.do("PUT", path, map[string]any{"name": "Apparel", "image": "/img/cat-clothes.webp", "isActive": false}); status != 200 {
		t.Fatalf("turn off: %d %v", status, body)
	}
	if got := categorySlugs(t, s); len(got) != 4 || equalStrings(got[:3], []string{"playcards", "sports-toys", "tech-toys"}) == false {
		t.Fatalf("shop categories after turning clothes off = %v", got)
	}
	if n := queryInt(t, "SELECT count(*) FROM products p JOIN categories c ON c.id = p.category_id WHERE c.slug = 'clothes'"); n != 3 {
		t.Fatalf("clothes products = %d", n)
	}
	if status, body := c.do("PUT", path, map[string]any{"slug": "apparel", "name": "Apparel", "isActive": true}); status != 422 || fieldError(body, "slug") == "" {
		t.Fatalf("slug change: %d %v", status, body)
	}
	if status, _ := c.do("DELETE", path, nil); status != 404 {
		t.Fatalf("DELETE a category: %d (there must be no delete)", status)
	}

	// Reorder: board games first.
	_, body = c.do("GET", "/api/admin/categories", nil)
	ids := []int64{}
	for _, x := range body["categories"].([]any) {
		ids = append(ids, int64(num(x.(map[string]any)["id"])))
	}
	order := append([]int64{ids[len(ids)-1]}, ids[:len(ids)-1]...)
	if status, _ := c.do("PUT", "/api/admin/categories/order", map[string]any{"ids": order}); status != 200 {
		t.Fatal("reorder")
	}
	if got := categorySlugs(t, s); got[0] != "board-games" {
		t.Fatalf("after reorder = %v", got)
	}
	if status, _ := c.do("PUT", "/api/admin/categories/order", map[string]any{"ids": order[1:]}); status != 422 {
		t.Fatal("reorder with a missing id was accepted")
	}
}

func TestAdminSettings(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)

	status, body := c.do("GET", "/api/admin/settings", nil)
	list := body["settings"].([]any)
	if status != 200 || len(list) != 11 {
		t.Fatalf("settings: %d %d", status, len(list))
	}
	first := list[0].(map[string]any)
	if first["key"] != "cod_confirm_hours" || num(first["value"]) != 48 || num(first["max"]) != 168 {
		t.Fatalf("first setting = %v", first)
	}

	// Bad values: nothing is saved, even the good ones.
	for key, value := range map[string]any{
		"cod_confirm_hours": 0, "default_purchase_limit": 51, "return_days": 31, "low_stock_threshold": -1,
		"free_delivery_enabled": "yes", "home_hero_product_slug": "no-such-product", "no_such_key": 1,
	} {
		status, body := c.do("PUT", "/api/admin/settings", map[string]any{"values": map[string]any{key: value, "gift_note_max_chars": 100}})
		if status != 422 || fieldError(body, key) == "" {
			t.Errorf("%s = %v: %d %v", key, value, status, body)
		}
	}
	_, pub := do(t, s, "GET", "/api/settings/public", nil)
	if num(pub["giftNoteMaxChars"]) != 150 || num(pub["returnDays"]) != 3 {
		t.Fatalf("a refused save changed something: %v", pub)
	}

	// Good values: the shop sees them at once.
	status, body = c.do("PUT", "/api/admin/settings", map[string]any{"values": map[string]any{
		"cod_confirm_hours": 24, "return_days": 7, "default_purchase_limit": 3, "home_hero_product_slug": "night-striker-football",
	}})
	if status != 200 {
		t.Fatalf("save: %d %v", status, body)
	}
	_, pub = do(t, s, "GET", "/api/settings/public", nil)
	if num(pub["codConfirmHours"]) != 24 || num(pub["returnDays"]) != 7 || num(pub["defaultPurchaseLimit"]) != 3 {
		t.Fatalf("public settings = %v", pub)
	}
	_, featured := do(t, s, "GET", "/api/products/featured", nil)
	if hero, _ := featured["hero"].(map[string]any); hero == nil || hero["slug"] != "night-striker-football" {
		t.Fatalf("hero = %v", featured["hero"])
	}
	// The hero may be "none".
	c.do("PUT", "/api/admin/settings", map[string]any{"values": map[string]any{"home_hero_product_slug": ""}})
	if _, featured := do(t, s, "GET", "/api/products/featured", nil); featured["hero"] != nil {
		t.Fatalf("hero after none = %v", featured["hero"])
	}

	// The lockout numbers are used by the login at once.
	c.do("PUT", "/api/admin/settings", map[string]any{"values": map[string]any{"login_max_failures": 3}})
	other := newAdminClient(t, s)
	for range 3 {
		other.do("POST", "/api/admin/login", map[string]any{"email": ownerEmail, "password": "wrong password!"})
	}
	if n := queryInt(t, "SELECT count(*) FROM admins WHERE locked_until IS NOT NULL"); n != 1 {
		t.Fatal("not locked after 3 failures")
	}
}

func zoneID(t *testing.T, code string) int64 {
	return int64(queryInt(t, "SELECT id FROM delivery_zones WHERE code = $1", code))
}

func TestAdminDeliveryCharges(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	inside := zoneID(t, "INSIDE_DHAKA")
	ball := variantID(t, "BALL-5")
	dhakaCity := areaID(t, "Dhaka", "Dhaka city")
	before, _ := placeTestOrder(t, s, "01712345678", line(ball, 1))

	status, body := c.do("GET", "/api/admin/delivery", nil)
	if status != 200 || len(body["zones"].([]any)) != 2 || len(body["areas"].([]any)) != 65 || body["freeDeliveryEnabled"] != false {
		t.Fatalf("delivery: %d zones=%d areas=%d", status, len(body["zones"].([]any)), len(body["areas"].([]any)))
	}

	// New charge: ৳70. The website's quote uses it at once; the old order keeps ৳60.
	zonePath := fmt.Sprintf("/api/admin/delivery/zones/%d", inside)
	if status, body := c.do("PUT", zonePath, map[string]any{"name": "Inside Dhaka", "chargePaisa": 7000, "freeOverPaisa": nil, "isActive": true}); status != 200 {
		t.Fatalf("new charge: %d %v", status, body)
	}
	_, quote := do(t, s, "POST", "/api/checkout/quote", map[string]any{"items": []any{line(ball, 1)}, "deliveryAreaId": dhakaCity})
	if d := quote["delivery"].(map[string]any); num(d["chargePaisa"]) != 7000 {
		t.Fatalf("quote charge = %v", d["chargePaisa"])
	}
	if n := queryInt(t, "SELECT delivery_paisa FROM orders WHERE order_number = $1", before); n != 6000 {
		t.Fatalf("the old order changed its delivery to %d", n)
	}
	if status, body := c.do("PUT", zonePath, map[string]any{"name": "Inside Dhaka", "chargePaisa": -1, "isActive": true}); status != 422 || fieldError(body, "chargePaisa") == "" {
		t.Fatalf("negative charge: %d %v", status, body)
	}

	// Free delivery over ৳1,500 in this zone, switched on.
	c.do("PUT", zonePath, map[string]any{"name": "Inside Dhaka", "chargePaisa": 7000, "freeOverPaisa": 150000, "isActive": true})
	c.do("PUT", "/api/admin/settings", map[string]any{"values": map[string]any{"free_delivery_enabled": true}})
	_, quote = do(t, s, "POST", "/api/checkout/quote", map[string]any{"items": []any{line(ball, 1)}, "deliveryAreaId": dhakaCity})
	if d := quote["delivery"].(map[string]any); d["freeDelivery"] != true || num(d["chargePaisa"]) != 0 {
		t.Fatalf("free delivery quote = %v", d)
	}

	// A zone that still has areas cannot be turned off.
	if status, body := c.do("PUT", zonePath, map[string]any{"name": "Inside Dhaka", "chargePaisa": 7000, "isActive": false}); status != 409 || errorCode(body) != "ZONE_IN_USE" {
		t.Fatalf("turn off a used zone: %d %v", status, body)
	}
}

func TestAdminDeliveryAreas(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)

	// Split Chattogram: a new zone, a new "city" area, the old area renamed.
	status, body := c.do("POST", "/api/admin/delivery/zones", map[string]any{"code": "ctg_city", "name": "Chattogram city", "chargePaisa": 8000})
	if status != 200 {
		t.Fatalf("new zone: %d %v", status, body)
	}
	ctg := zoneID(t, "CTG_CITY")
	if status, _ := c.do("POST", "/api/admin/delivery/zones", map[string]any{"code": "CTG_CITY", "name": "Again", "chargePaisa": 1}); status != 422 {
		t.Fatal("duplicate zone code accepted")
	}
	if status, body := c.do("POST", "/api/admin/delivery/areas", map[string]any{"district": "Chattogram", "label": "Chattogram city", "hint": "Inside the city corporation", "zoneId": ctg}); status != 200 {
		t.Fatalf("new area: %d %v", status, body)
	}
	if status, _ := c.do("POST", "/api/admin/delivery/areas", map[string]any{"district": "Atlantis", "label": "City", "zoneId": ctg}); status != 422 {
		t.Fatal("unknown district accepted")
	}
	if status, _ := c.do("POST", "/api/admin/delivery/areas", map[string]any{"district": "Chattogram", "label": "Chattogram city", "zoneId": ctg}); status != 422 {
		t.Fatal("duplicate area accepted")
	}
	old := areaID(t, "Chattogram", "Chattogram")
	outside := zoneID(t, "OUTSIDE_DHAKA")
	if status, body := c.do("PUT", fmt.Sprintf("/api/admin/delivery/areas/%d", old), map[string]any{"label": "Outside Chattogram city", "hint": "", "zoneId": outside, "isActive": true}); status != 200 {
		t.Fatalf("rename area: %d %v", status, body)
	}

	// The checkout now asks "city or outside" for Chattogram.
	_, areas := do(t, s, "GET", "/api/delivery/areas", nil)
	for _, d := range areas["districts"].([]any) {
		d := d.(map[string]any)
		if d["name"] == "Chattogram" {
			list := d["areas"].([]any)
			if len(list) != 2 {
				t.Fatalf("Chattogram areas = %v", list)
			}
		}
	}
	city := areaID(t, "Chattogram", "Chattogram city")
	_, quote := do(t, s, "POST", "/api/checkout/quote", map[string]any{"items": []any{line(variantID(t, "BALL-5"), 1)}, "deliveryAreaId": city})
	if d := quote["delivery"].(map[string]any); num(d["chargePaisa"]) != 8000 || d["zoneCode"] != "CTG_CITY" {
		t.Fatalf("Chattogram city quote = %v", d)
	}

	// Move "Outside Dhaka city" into the inside zone (the mapping is the admin's).
	outsideDhaka := areaID(t, "Dhaka", "Outside Dhaka city")
	inside := zoneID(t, "INSIDE_DHAKA")
	c.do("PUT", fmt.Sprintf("/api/admin/delivery/areas/%d", outsideDhaka), map[string]any{"label": "Outside Dhaka city", "hint": "Savar, Keraniganj and others", "zoneId": inside, "isActive": true})
	_, quote = do(t, s, "POST", "/api/checkout/quote", map[string]any{"items": []any{line(variantID(t, "BALL-5"), 1)}, "deliveryAreaId": outsideDhaka})
	if d := quote["delivery"].(map[string]any); num(d["chargePaisa"]) != 6000 {
		t.Fatalf("moved area quote = %v", d)
	}
	if status, _ := c.do("PUT", fmt.Sprintf("/api/admin/delivery/areas/%d", outsideDhaka), map[string]any{"district": "Gazipur", "label": "x y", "zoneId": inside, "isActive": true}); status != 422 {
		t.Fatal("moving an area to another district was accepted")
	}
	if status, _ := c.do("PUT", "/api/admin/delivery/areas/999999", map[string]any{"label": "Nowhere", "zoneId": inside, "isActive": true}); status != http.StatusNotFound {
		t.Fatal("unknown area")
	}
}
