package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func productOf(body map[string]any) map[string]any {
	p, _ := body["product"].(map[string]any)
	return p
}

func fieldError(body map[string]any, field string) string {
	e, _ := body["error"].(map[string]any)
	f, _ := e["fields"].(map[string]any)
	s, _ := f[field].(string)
	return s
}

func newProductBody(name string) map[string]any {
	return map[string]any{
		"name": name, "categorySlug": "playcards", "kind": "Collectible card", "variantKind": "Edition",
		"isLimited": true, "editionSize": 50, "purchaseLimit": 2, "summary": "A test run.",
		"story":   []string{"First paragraph.", "  ", "Second paragraph."},
		"details": []map[string]any{{"term": "Size", "text": "63 × 88 mm"}},
	}
}

// draftProduct makes a DRAFT with one photo and one variant (price ৳1,600,
// stock 10), ready to publish. It returns the product and variant ids.
func draftProduct(t *testing.T, c *adminClient, name string) (int64, int64) {
	t.Helper()
	status, body := c.do("POST", "/api/admin/products", newProductBody(name))
	if status != http.StatusCreated {
		t.Fatalf("create: %d %v", status, body)
	}
	id := int64(num(productOf(body)["id"]))
	if status, body := c.do("POST", fmt.Sprintf("/api/admin/products/%d/images", id),
		map[string]any{"url": "/img/p-dragon-flame-set.webp", "alt": "The test deck", "shortName": "Front"}); status != http.StatusCreated {
		t.Fatalf("image: %d %v", status, body)
	}
	status, body = c.do("POST", fmt.Sprintf("/api/admin/products/%d/variants", id),
		map[string]any{"sku": fmt.Sprintf("tst-%d", id), "label": "Standard", "pricePaisa": 160000})
	if status != http.StatusCreated {
		t.Fatalf("variant: %d %v", status, body)
	}
	variants := productOf(body)["variants"].([]any)
	vid := int64(num(variants[len(variants)-1].(map[string]any)["id"]))
	stock(t, c, vid, 10, "RESTOCK", "First stock from the printer")
	return id, vid
}

func stock(t *testing.T, c *adminClient, variantID int64, change int, reason, note string) (int, map[string]any) {
	t.Helper()
	return c.do("POST", fmt.Sprintf("/api/admin/variants/%d/stock", variantID),
		map[string]any{"change": change, "reason": reason, "note": note})
}

// publish confirms exactly the prices the product has now.
func publish(t *testing.T, c *adminClient, id int64) (int, map[string]any) {
	t.Helper()
	_, body := c.do("GET", fmt.Sprintf("/api/admin/products/%d", id), nil)
	prices := []map[string]any{}
	for _, v := range productOf(body)["variants"].([]any) {
		v := v.(map[string]any)
		if v["isActive"] == true {
			prices = append(prices, map[string]any{"variantId": v["id"], "pricePaisa": v["pricePaisa"]})
		}
	}
	return c.do("POST", fmt.Sprintf("/api/admin/products/%d/publish", id), map[string]any{"prices": prices})
}

func TestAdminCreateProductIsDraftAndHidden(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	status, body := c.do("POST", "/api/admin/products", newProductBody("Founders Playcard Deck · II"))
	p := productOf(body)
	if status != 201 || p["status"] != "DRAFT" || p["slug"] != "founders-playcard-deck-ii" {
		t.Fatalf("create: %d %v", status, body)
	}
	if story := p["story"].([]any); len(story) != 2 {
		t.Fatalf("empty paragraphs should be dropped: %v", story)
	}
	if status, _ := do(t, s, "GET", "/api/products/founders-playcard-deck-ii", nil); status != 404 {
		t.Fatalf("a draft is visible in the shop: %d", status)
	}
	// The list shows every status with counts.
	_, body = c.do("GET", "/api/admin/products?status=DRAFT", nil)
	if rows := body["products"].([]any); len(rows) != 1 || num(body["counts"].(map[string]any)["DRAFT"]) != 1 {
		t.Fatalf("draft list: %v", body)
	}
	_, body = c.do("GET", "/api/admin/products?q=hd02", nil) // SKU search
	if rows := body["products"].([]any); len(rows) != 1 || rows[0].(map[string]any)["slug"] != "ember-night-hoodie-edition-02" {
		t.Fatalf("sku search: %v", rows)
	}
	_, body = c.do("GET", "/api/admin/products?category=clothes", nil)
	if rows := body["products"].([]any); len(rows) != 3 {
		t.Fatalf("clothes = %d", len(rows))
	}
}

func TestAdminProductValidation(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	for field, change := range map[string]map[string]any{
		"name":          {"name": "x"},
		"categorySlug":  {"categorySlug": "nope"},
		"kind":          {"kind": ""},
		"purchaseLimit": {"purchaseLimit": 51},
		"editionSize":   {"editionSize": 0},
		"slug":          {"slug": "Bad Slug!"},
		"featuredOrder": {"featuredOrder": 1}, // the Dragon Flame card has place 1
		"successorSlug": {"successorSlug": "no-such-product"},
	} {
		b := newProductBody("Validation test")
		for k, v := range change {
			b[k] = v
		}
		status, body := c.do("POST", "/api/admin/products", b)
		if status != 422 || fieldError(body, field) == "" {
			t.Errorf("%s: %d %v", field, status, body)
		}
	}
	// Same slug twice.
	c.do("POST", "/api/admin/products", newProductBody("Twin"))
	if status, body := c.do("POST", "/api/admin/products", newProductBody("Twin")); status != 422 || fieldError(body, "slug") == "" {
		t.Fatalf("duplicate slug: %d %v", status, body)
	}
	if status, body := c.do("POST", "/api/admin/products", map[string]any{"name": "x", "status": "ACTIVE"}); status != 400 || errorCode(body) != "UNKNOWN_FIELD" {
		t.Fatalf("status field must not be accepted: %d %v", status, body)
	}
}

func TestAdminPublishRules(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)

	// No photo, no variant.
	_, body := c.do("POST", "/api/admin/products", newProductBody("Empty draft"))
	empty := int64(num(productOf(body)["id"]))
	if problems := productOf(body)["publishProblems"].([]any); len(problems) != 2 {
		t.Fatalf("publishProblems = %v", problems)
	}
	if status, body := publish(t, c, empty); status != 409 || errorCode(body) != "CANNOT_PUBLISH" {
		t.Fatalf("publish an empty draft: %d %v", status, body)
	}

	id, vid := draftProduct(t, c, "Publish test deck")
	// The confirmed prices must be today's prices.
	if status, body := c.do("POST", fmt.Sprintf("/api/admin/products/%d/publish", id),
		map[string]any{"prices": []map[string]any{{"variantId": vid, "pricePaisa": 150000}}}); status != 409 || errorCode(body) != "PRICES_CHANGED" {
		t.Fatalf("wrong confirmed price: %d %v", status, body)
	}
	status, body := publish(t, c, id)
	if status != 200 || productOf(body)["status"] != "ACTIVE" {
		t.Fatalf("publish: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE product_id = $1 AND type = 'PUBLISH' AND actor = 'ADMIN' AND by_admin_id = $2", id, admin); n != 1 {
		t.Fatalf("PUBLISH events = %d", n)
	}
	// The record shows the prices in taka, like a price fix (not "160000").
	if r := queryString(t, "SELECT reason FROM product_events WHERE product_id = $1 AND type = 'PUBLISH'", id); r != fmt.Sprintf("Published at TST-%d ৳1,600", id) {
		t.Fatalf("PUBLISH reason = %q", r)
	}
	if status, _ := do(t, s, "GET", "/api/products/publish-test-deck", nil); status != 200 {
		t.Fatalf("published product not in the shop: %d", status)
	}
	if status, body := publish(t, c, id); status != 409 || errorCode(body) != "NOT_DRAFT" {
		t.Fatalf("publish twice: %d %v", status, body)
	}

	// A limited run without stock cannot go live.
	id2, vid2 := draftProduct(t, c, "No stock deck")
	stock(t, c, vid2, -10, "ADJUST", "Printer kept the cards")
	if status, body := publish(t, c, id2); status != 409 || errorCode(body) != "CANNOT_PUBLISH" {
		t.Fatalf("limited without stock: %d %v", status, body)
	}
}

func TestAdminPriceLockAndPriceFix(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	id, vid := draftProduct(t, c, "Price test deck")
	path := fmt.Sprintf("/api/admin/variants/%d", vid)

	// DRAFT: the price changes freely; a price fix is not needed (refused).
	if status, body := c.do("PUT", path, map[string]any{"sku": fmt.Sprintf("TST-%d", id), "label": "Standard", "pricePaisa": 170000}); status != 200 {
		t.Fatalf("draft price change: %d %v", status, body)
	}
	if status, body := c.do("POST", path+"/price-fix", map[string]any{"pricePaisa": 180000, "reason": "Typo in the price"}); status != 409 || errorCode(body) != "NOT_LIVE" {
		t.Fatalf("price fix on a draft: %d %v", status, body)
	}
	publish(t, c, id)

	// ACTIVE: locked.
	if status, body := c.do("PUT", path, map[string]any{"sku": fmt.Sprintf("TST-%d", id), "label": "Standard", "pricePaisa": 180000}); status != 409 || errorCode(body) != "PRICE_LOCKED" {
		t.Fatalf("live price change: %d %v", status, body)
	}
	if status, body := c.do("PUT", path, map[string]any{"sku": "OTHER-SKU", "label": "Standard", "pricePaisa": 170000}); status != 409 || errorCode(body) != "LOCKED" {
		t.Fatalf("live sku change: %d %v", status, body)
	}
	// The label still changes, and isActive (not sent) stays on.
	if status, body := c.do("PUT", path, map[string]any{"sku": fmt.Sprintf("TST-%d", id), "label": "Standard edition", "pricePaisa": 170000}); status != 200 ||
		productOf(body)["variants"].([]any)[0].(map[string]any)["isActive"] != true {
		t.Fatalf("live label change: %d %v", status, body)
	}

	// An order at the old price keeps it after the fix.
	number, _ := placeTestOrder(t, s, "01712345678", line(vid, 1))
	if status, body := c.do("POST", path+"/price-fix", map[string]any{"pricePaisa": 180000, "reason": ""}); status != 422 || fieldError(body, "reason") == "" {
		t.Fatalf("price fix without reason: %d %v", status, body)
	}
	status, body := c.do("POST", path+"/price-fix", map[string]any{"pricePaisa": 180000, "reason": "The printer raised the price"})
	if status != 200 || num(productOf(body)["variants"].([]any)[0].(map[string]any)["pricePaisa"]) != 180000 {
		t.Fatalf("price fix: %d %v", status, body)
	}
	if n := queryInt(t, `SELECT count(*) FROM product_events WHERE product_id = $1 AND type = 'PRICE_FIX'
	                     AND old_value = '170000' AND new_value = '180000' AND by_admin_id = $2`, id, admin); n != 1 {
		t.Fatal("no PRICE_FIX event with old and new price")
	}
	if n := queryInt(t, `SELECT i.unit_price_paisa FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.order_number = $1`, number); n != 170000 {
		t.Fatalf("the placed order changed price: %d", n)
	}
	_, quote := do(t, s, "POST", "/api/checkout/quote", map[string]any{"items": []any{line(vid, 1)}})
	if num(quote["subtotalPaisa"]) != 180000 {
		t.Fatalf("new quote = %v", quote["subtotalPaisa"])
	}
}

func TestAdminEditAndLockedFields(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	id, _ := draftProduct(t, c, "Edit test deck")
	path := fmt.Sprintf("/api/admin/products/%d", id)

	b := newProductBody("Edit test deck")
	b["summary"], b["kind"], b["variantKind"] = "New summary", "Card", "Finish"
	b["details"] = []map[string]any{{"term": "Paper", "text": "330 gsm"}, {"term": "Box", "text": "Magnetic"}}
	b["successorSlug"], b["featuredOrder"] = "dragon-flame-playcard-set", 7
	status, body := c.do("PUT", path, b)
	p := productOf(body)
	if status != 200 || p["summary"] != "New summary" || p["variantKind"] != "Finish" || len(p["details"].([]any)) != 2 ||
		p["successorSlug"] != "dragon-flame-playcard-set" || num(p["featuredOrder"]) != 7 {
		t.Fatalf("edit draft: %d %v", status, body)
	}
	b["slug"] = "edit-test-deck-2"
	if status, _ := c.do("PUT", path, b); status != 200 {
		t.Fatal("a draft's address can change")
	}

	publish(t, c, id)
	for field, value := range map[string]any{"slug": "another-address", "isLimited": false, "editionSize": 60} {
		x := newProductBody("Edit test deck")
		x["slug"] = "edit-test-deck-2"
		x[field] = value
		status, body := c.do("PUT", path, x)
		if status != 409 || errorCode(body) != "LOCKED" || fieldError(body, field) == "" {
			t.Errorf("%s on a live product: %d %v", field, status, body)
		}
	}
	b["name"], b["purchaseLimit"] = "Edit test deck (renamed)", nil
	if status, body := c.do("PUT", path, b); status != 200 || productOf(body)["purchaseLimit"] != nil {
		t.Fatalf("live name/limit change: %d %v", status, body)
	}
	if status, _ := c.do("DELETE", path, nil); status != 404 {
		t.Fatalf("DELETE a product: %d (there must be no delete)", status)
	}
}

func TestAdminStockRules(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	sleeves := variantID(t, "SLV-100") // not limited, stock 48

	if status, body := stock(t, c, sleeves, 5, "RESTOCK", ""); status != 422 || fieldError(body, "note") == "" {
		t.Fatalf("no note: %d %v", status, body)
	}
	if status, body := stock(t, c, sleeves, -1, "RESTOCK", "Wrong reason"); status != 422 || fieldError(body, "change") == "" {
		t.Fatalf("negative restock: %d %v", status, body)
	}
	if status, body := stock(t, c, sleeves, 1, "ORDER", "Not allowed"); status != 422 || fieldError(body, "reason") == "" {
		t.Fatalf("reason ORDER: %d %v", status, body)
	}
	if status, body := stock(t, c, sleeves, -49, "ADJUST", "Counted the boxes"); status != 409 || errorCode(body) != "STOCK_BELOW_ZERO" {
		t.Fatalf("below zero: %d %v", status, body)
	}
	if status, _ := stock(t, c, sleeves, 12, "RESTOCK", "New boxes arrived"); status != 200 {
		t.Fatal("restock")
	}
	if status, _ := stock(t, c, sleeves, -2, "ADJUST", "Two boxes were wet"); status != 200 {
		t.Fatal("adjust")
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE id = $1", sleeves); n != 58 {
		t.Fatalf("stock = %d, want 58", n)
	}
	if n := queryInt(t, `SELECT count(*) FROM inventory_movements WHERE variant_id = $1 AND by_admin_id = $2
	                     AND ((reason = 'RESTOCK' AND change = 12) OR (reason = 'ADJUST' AND change = -2))`, sleeves, admin); n != 2 {
		t.Fatalf("stock book rows = %d", n)
	}

	// Limited drone: taking the last 3 away makes it SOLD_OUT (recorded),
	// and then it can never be restocked.
	drone := variantID(t, "DRN-01")
	if status, _ := stock(t, c, drone, -3, "ADJUST", "Three arrived broken"); status != 200 {
		t.Fatal("adjust drone")
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "SOLD_OUT" {
		t.Fatalf("drone = %s", st)
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'SOLD_OUT' AND actor = 'ADMIN' AND by_admin_id = $1", admin); n != 1 {
		t.Fatal("no SOLD_OUT event by the admin")
	}
	for _, reason := range []string{"RESTOCK", "ADJUST"} {
		if status, body := stock(t, c, drone, 5, reason, "More drones came"); status != 409 || errorCode(body) != "LIMITED_NO_RESTOCK" {
			t.Fatalf("restock a sold-out limited run (%s): %d %v", reason, status, body)
		}
	}
	// The same for an archived limited run (seed: Hoodie Edition 01).
	hoodie01 := int64(queryInt(t, `SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id
	                               WHERE p.slug = 'ember-night-hoodie-edition-01' LIMIT 1`))
	if status, body := stock(t, c, hoodie01, 1, "RESTOCK", "Found one in the store"); status != 409 || errorCode(body) != "LIMITED_NO_RESTOCK" {
		t.Fatalf("restock an archived limited run: %d %v", status, body)
	}
}

func TestAdminArchiveAndReactivate(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	drone := int64(queryInt(t, "SELECT id FROM products WHERE slug = 'midnight-circuit-desk-drone'"))
	path := fmt.Sprintf("/api/admin/products/%d", drone)

	if status, body := c.do("POST", path+"/archive", map[string]any{}); status != 409 || errorCode(body) != "NOT_SOLD_OUT" {
		t.Fatalf("archive an ACTIVE product: %d %v", status, body)
	}
	stock(t, c, variantID(t, "DRN-01"), -3, "ADJUST", "Three arrived broken")
	if status, body := c.do("POST", path+"/archive", map[string]any{"reason": "Done with this run"}); status != 200 || productOf(body)["status"] != "ARCHIVED" {
		t.Fatalf("archive: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT count(*) FROM products WHERE id = $1 AND archived_at IS NOT NULL AND sold_out_at IS NOT NULL", drone); n != 1 {
		t.Fatal("archived_at / sold_out_at not kept")
	}

	if status, body := c.do("POST", path+"/reactivate", map[string]any{"reason": "short"}); status != 422 || fieldError(body, "reason") == "" {
		t.Fatalf("reactivate with a short reason: %d %v", status, body)
	}
	status, body := c.do("POST", path+"/reactivate", map[string]any{"reason": "Collectors asked for a second batch"})
	if status != 200 || productOf(body)["status"] != "ACTIVE" {
		t.Fatalf("reactivate: %d %v", status, body)
	}
	if n := queryInt(t, `SELECT count(*) FROM product_events WHERE product_id = $1 AND type = 'REACTIVATE' AND by_admin_id = $2
	                     AND reason = 'Collectors asked for a second batch' AND old_value = 'ARCHIVED'`, drone, admin); n != 1 {
		t.Fatal("no REACTIVATE event with the reason")
	}
	if status, body := c.do("POST", path+"/reactivate", map[string]any{"reason": "Collectors asked again"}); status != 409 || errorCode(body) != "NOT_ARCHIVED" {
		t.Fatalf("reactivate an ACTIVE product: %d %v", status, body)
	}
}

func TestAdminVariantsAndImages(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	id, vid := draftProduct(t, c, "Photo test deck")
	base := fmt.Sprintf("/api/admin/products/%d", id)

	// A second variant: SKU taken, bad price, then fine.
	if status, body := c.do("POST", base+"/variants", map[string]any{"sku": "HD02-M", "label": "Foil", "pricePaisa": 1}); status != 422 || fieldError(body, "sku") == "" {
		t.Fatalf("taken sku: %d %v", status, body)
	}
	if status, body := c.do("POST", base+"/variants", map[string]any{"sku": "PT-FOIL", "label": "Foil", "pricePaisa": 0}); status != 422 || fieldError(body, "pricePaisa") == "" {
		t.Fatalf("zero price: %d %v", status, body)
	}
	_, body := c.do("POST", base+"/variants", map[string]any{"sku": "pt-foil", "label": "Foil", "pricePaisa": 210000})
	variants := productOf(body)["variants"].([]any)
	foil := variants[1].(map[string]any)
	if foil["sku"] != "PT-FOIL" || num(foil["stock"]) != 0 {
		t.Fatalf("new variant = %v", foil)
	}
	foilID := int64(num(foil["id"]))

	// Photos: bad address refused; two more photos.
	if status, body := c.do("POST", base+"/images", map[string]any{"url": "javascript:alert(1)", "alt": "x"}); status != 422 || fieldError(body, "url") == "" {
		t.Fatalf("bad url: %d %v", status, body)
	}
	if status, body := c.do("POST", base+"/images", map[string]any{"url": "/img/p-card-sleeves.webp", "alt": ""}); status != 422 || fieldError(body, "alt") == "" {
		t.Fatalf("no alt: %d %v", status, body)
	}
	c.do("POST", base+"/images", map[string]any{"url": "/img/c-df-metal.webp", "thumbUrl": "/img/t-c-df-metal.webp", "alt": "Foil card", "shortName": "Foil"})
	_, body = c.do("POST", base+"/images", map[string]any{"url": "https://images.example.com/back.webp", "alt": "Back of the box"})
	imgs := productOf(body)["images"].([]any)
	if len(imgs) != 3 || imgs[1].(map[string]any)["thumbUrl"] != "/img/t-c-df-metal.webp" || imgs[2].(map[string]any)["thumbUrl"] != "https://images.example.com/back.webp" {
		t.Fatalf("images = %v", imgs)
	}
	ids := []int64{}
	for _, i := range imgs {
		ids = append(ids, int64(num(i.(map[string]any)["id"])))
	}

	// The foil variant shows photo 1 (the foil card); imageIndex 5 does not exist.
	put := func(idx any) (int, map[string]any) {
		return c.do("PUT", fmt.Sprintf("/api/admin/variants/%d", foilID), map[string]any{"sku": "PT-FOIL", "label": "Foil", "pricePaisa": 210000, "imageIndex": idx})
	}
	if status, body := put(5); status != 422 || fieldError(body, "imageIndex") == "" {
		t.Fatalf("imageIndex 5: %d %v", status, body)
	}
	put(1)

	// Reorder: foil photo first. The foil variant must follow it (index 0).
	_, body = c.do("PUT", base+"/images/order", map[string]any{"ids": []int64{ids[1], ids[0], ids[2]}})
	if idx := productOf(body)["variants"].([]any)[1].(map[string]any)["imageIndex"]; num(idx) != 0 {
		t.Fatalf("after reorder imageIndex = %v, want 0", idx)
	}
	if status, _ := c.do("PUT", base+"/images/order", map[string]any{"ids": []int64{ids[0], ids[1]}}); status != 422 {
		t.Fatalf("reorder with a missing id: %d", status)
	}
	// Remove the foil photo: the variant shows no special photo now.
	_, body = c.do("DELETE", fmt.Sprintf("/api/admin/images/%d", ids[1]), nil)
	if p := productOf(body); len(p["images"].([]any)) != 2 || p["variants"].([]any)[1].(map[string]any)["imageIndex"] != nil {
		t.Fatalf("after remove: %v", p)
	}
	// Edit the alt text of a photo.
	if status, body := c.do("PUT", fmt.Sprintf("/api/admin/images/%d", ids[0]), map[string]any{"url": "/img/p-dragon-flame-set.webp", "alt": "New words", "shortName": "Front"}); status != 200 ||
		productOf(body)["images"].([]any)[0].(map[string]any)["alt"] != "New words" {
		t.Fatalf("edit image: %d %v", status, body)
	}

	// Turn the foil variant off: gone from the shop after publish, still in the admin.
	c.do("PUT", fmt.Sprintf("/api/admin/variants/%d", foilID), map[string]any{"sku": "PT-FOIL", "label": "Foil", "pricePaisa": 210000, "isActive": false})
	publish(t, c, id)
	_, shop := do(t, s, "GET", "/api/products/photo-test-deck", nil)
	if v := productOf(shop)["variants"].([]any); len(v) != 1 {
		t.Fatalf("shop variants = %d, want 1 (foil is off)", len(v))
	}

	// A live product keeps at least one photo.
	_, body = c.do("GET", base, nil)
	for _, i := range productOf(body)["images"].([]any)[1:] {
		c.do("DELETE", fmt.Sprintf("/api/admin/images/%d", int64(num(i.(map[string]any)["id"]))), nil)
	}
	_, body = c.do("GET", base, nil)
	last := int64(num(productOf(body)["images"].([]any)[0].(map[string]any)["id"]))
	if status, body := c.do("DELETE", fmt.Sprintf("/api/admin/images/%d", last), nil); status != 409 || errorCode(body) != "LAST_PHOTO" {
		t.Fatalf("remove the last photo of a live product: %d %v", status, body)
	}
	_ = vid
}

// Open question 19: a new variant on a live product sets a new price, so it
// needs a written reason and leaves a PRICE_FIX record (no old price).
func TestAdminNewVariantOnLiveProductNeedsAReason(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	id := queryInt(t, "SELECT id FROM products WHERE slug = 'card-sleeves-ember-100'") // ACTIVE
	path := fmt.Sprintf("/api/admin/products/%d/variants", id)
	v := map[string]any{"sku": "SLV-50", "label": "Box of 50", "pricePaisa": 20000}

	if status, body := c.do("POST", path, v); status != 422 || fieldError(body, "reason") == "" {
		t.Fatalf("no reason: %d %v", status, body)
	}
	v["reason"] = "ok"
	if status, body := c.do("POST", path, v); status != 422 || fieldError(body, "reason") == "" {
		t.Fatalf("too short: %d %v", status, body)
	}
	v["reason"] = "Smaller box for new players"
	if status, body := c.do("POST", path, v); status != 201 {
		t.Fatalf("with a reason: %d %v", status, body)
	}
	if n := queryInt(t, `SELECT count(*) FROM product_events WHERE product_id = $1 AND type = 'PRICE_FIX'
	                     AND old_value IS NULL AND new_value = '20000' AND by_admin_id = $2
	                     AND reason = 'New variant SLV-50: Smaller box for new players'`, id, admin); n != 1 {
		t.Fatalf("PRICE_FIX records for the new variant = %d", n)
	}

	// A draft needs no reason and leaves no record (the price is checked at publish).
	draft, _ := draftProduct(t, c, "Reason test deck")
	if status, body := c.do("POST", fmt.Sprintf("/api/admin/products/%d/variants", draft),
		map[string]any{"sku": "RT-2", "label": "Second", "pricePaisa": 1000}); status != 201 {
		t.Fatalf("draft: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE product_id = $1", draft); n != 0 {
		t.Fatalf("draft events = %d", n)
	}
}

// Open question 20: turning variants off or on re-checks "sold out".
func TestAdminVariantOnOffRechecksSoldOut(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	admin := ownerID(t)
	drone := variantID(t, "DRN-01") // the only variant of a limited product, stock 3
	path := fmt.Sprintf("/api/admin/variants/%d", drone)
	body := map[string]any{"sku": "DRN-01", "label": "Standard", "note": "",
		"pricePaisa": queryInt(t, "SELECT price_paisa FROM product_variants WHERE id = $1", drone),
		"imageIndex": nil, "sortOrder": 0, "isActive": false}
	status := func() string {
		return queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'")
	}

	if code, res := c.do("PUT", path, body); code != 200 {
		t.Fatalf("turn off: %d %v", code, res)
	}
	if st := status(); st != "SOLD_OUT" {
		t.Fatalf("after turning the last variant off: %s, want SOLD_OUT", st)
	}
	body["isActive"] = true
	if code, res := c.do("PUT", path, body); code != 200 {
		t.Fatalf("turn on: %d %v", code, res)
	}
	if st := status(); st != "ACTIVE" {
		t.Fatalf("after turning it on again: %s, want ACTIVE", st)
	}
	if n := queryInt(t, `SELECT count(*) FROM product_events e JOIN products p ON p.id = e.product_id
	                     WHERE p.slug = 'midnight-circuit-desk-drone' AND e.by_admin_id = $1
	                     AND e.type IN ('SOLD_OUT', 'REACTIVATE')`, admin); n != 2 {
		t.Fatalf("records = %d, want SOLD_OUT and REACTIVATE", n)
	}

	// A product that is not limited never becomes SOLD_OUT.
	ball := variantID(t, "BALL-5")
	b := map[string]any{"sku": "BALL-5", "label": queryString(t, "SELECT label FROM product_variants WHERE id = $1", ball), "note": "",
		"pricePaisa": queryInt(t, "SELECT price_paisa FROM product_variants WHERE id = $1", ball),
		"imageIndex": nil, "sortOrder": 0, "isActive": false}
	if code, res := c.do("PUT", fmt.Sprintf("/api/admin/variants/%d", ball), b); code != 200 {
		t.Fatalf("ball off: %d %v", code, res)
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'night-striker-football'"); st != "ACTIVE" {
		t.Fatalf("not limited: %s", st)
	}
}

// Open question 21: an option name must not repeat the kind ("Size M" for
// a Size product would show as "Size Size M").
func TestAdminVariantLabelMustNotRepeatTheKind(t *testing.T) {
	s := newTestServer(t, true)
	c := loginOwner(t, s)
	id, variant := draftProduct(t, c, "Kind Test Tee")
	exec(t, "UPDATE products SET variant_kind = 'Size' WHERE id = $1", id)
	path := fmt.Sprintf("/api/admin/products/%d/variants", id)

	for _, label := range []string{"Size M", "size XL", "SIZE: L", "Size-  S"} {
		status, body := c.do("POST", path, map[string]any{"sku": "KT-X", "label": label, "pricePaisa": 90000})
		if status != 422 || !strings.Contains(fieldError(body, "label"), "Leave out the word “Size”") {
			t.Errorf("%q: %d %v", label, status, body)
		}
	}
	// Fine: the option alone, the bare word, and words that only start alike.
	for i, label := range []string{"M", "Size", "Sizeable", "Extra Size M"} {
		status, body := c.do("POST", path, map[string]any{"sku": fmt.Sprintf("KT-%d", i), "label": label, "pricePaisa": 90000})
		if status != http.StatusCreated {
			t.Errorf("%q: %d %v", label, status, body)
		}
	}
	// Editing an option checks the same rule.
	status, body := c.do("PUT", fmt.Sprintf("/api/admin/variants/%d", variant),
		map[string]any{"sku": fmt.Sprintf("TST-%d", id), "label": "Size L", "pricePaisa": 160000})
	if status != 422 || fieldError(body, "label") == "" {
		t.Fatalf("edit to Size L: %d %v", status, body)
	}
	if n := queryInt(t, "SELECT count(*) FROM product_variants WHERE product_id = $1 AND label ILIKE 'size %'", id); n != 0 {
		t.Fatalf("%d labels starting with the kind were saved", n)
	}
}
