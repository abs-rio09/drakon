package jobs

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/abs-rio09/drakon/api/internal/orders"
	"github.com/abs-rio09/drakon/api/internal/testdb"
)

var testDB *testdb.DB

func TestMain(m *testing.M) {
	d, err := testdb.Setup(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "test database:", err)
		os.Exit(1)
	}
	testDB = d
	code := m.Run()
	d.Close()
	os.Exit(code)
}

// A fixed "now" for every test: 16 Oct 2026, 12:00 in Dhaka.
var now = time.Date(2026, 10, 16, 12, 0, 0, 0, time.FixedZone("BST", 6*3600))

func setup(t *testing.T) *Sweeper {
	t.Helper()
	if err := testDB.Reset(context.Background(), true); err != nil {
		t.Fatal(err)
	}
	s := NewSweeper(testDB.Pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	s.Now = func() time.Time { return now }
	return s
}

func exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := testDB.Pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

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

// placeOrder places an order for qty of sku and moves its created_at back
// to placedAt (orders are stamped by the database clock).
func placeOrder(t *testing.T, phone, sku string, qty int, placedAt time.Time) string {
	t.Helper()
	ctx := context.Background()
	var variantID, areaID int64
	if err := testDB.Pool.QueryRow(ctx, "SELECT id FROM product_variants WHERE sku = $1", sku).Scan(&variantID); err != nil {
		t.Fatal(err)
	}
	if err := testDB.Pool.QueryRow(ctx, "SELECT id FROM delivery_areas WHERE area_label = 'Dhaka city'").Scan(&areaID); err != nil {
		t.Fatal(err)
	}
	placed, err := orders.Place(ctx, testDB.Pool, orders.Checkout{
		Items: []orders.Line{{VariantID: variantID, Qty: qty}}, DeliveryAreaID: &areaID,
		Name: "Test Buyer", Phone: phone, Area: "Mirpur 10", Address: "House 1, Road 2, Block C",
	}, placedAt)
	if err != nil {
		t.Fatal(err)
	}
	exec(t, "UPDATE orders SET created_at = $1 WHERE order_number = $2", placedAt, placed.OrderNumber)
	return placed.OrderNumber
}

func status(t *testing.T, number string) string {
	return queryString(t, "SELECT status::text FROM orders WHERE order_number = $1", number)
}

func TestAutoCancelOldPendingOrders(t *testing.T) {
	s := setup(t)
	old := placeOrder(t, "01712345601", "BALL-5", 2, now.Add(-49*time.Hour))   // too old
	fresh := placeOrder(t, "01712345602", "BALL-5", 1, now.Add(-47*time.Hour)) // still inside 48 h
	confirmed := placeOrder(t, "01712345603", "BALL-5", 1, now.Add(-72*time.Hour))
	exec(t, "UPDATE orders SET status = 'CONFIRMED' WHERE order_number = $1", confirmed)
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'BALL-5'"); n != 16 {
		t.Fatalf("stock before = %d", n)
	}

	res, err := s.RunOnce(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if res.Cancelled != 1 {
		t.Fatalf("cancelled = %d, want 1", res.Cancelled)
	}
	if status(t, old) != "CANCELLED" || status(t, fresh) != "PENDING" || status(t, confirmed) != "CONFIRMED" {
		t.Fatalf("statuses: %s %s %s", status(t, old), status(t, fresh), status(t, confirmed))
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'BALL-5'"); n != 18 {
		t.Errorf("stock after = %d, want 18 (2 back)", n)
	}
	if r := queryString(t, "SELECT cancel_reason FROM orders WHERE order_number = $1", old); r != "Not confirmed by phone within 48 hours" {
		t.Errorf("reason = %q", r)
	}
	if n := queryInt(t, "SELECT count(*) FROM order_status_history h JOIN orders o ON o.id = h.order_id WHERE o.order_number = $1 AND h.actor = 'SYSTEM' AND h.to_status = 'CANCELLED'", old); n != 1 {
		t.Errorf("history rows = %d", n)
	}

	// Safe to run twice: nothing more happens, stock is not added again.
	res, err = s.RunOnce(context.Background())
	if err != nil || res.Cancelled != 0 {
		t.Fatalf("second run: %+v %v", res, err)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'BALL-5'"); n != 18 {
		t.Errorf("stock after second run = %d", n)
	}
}

func TestAutoCancelUsesTheSetting(t *testing.T) {
	s := setup(t)
	exec(t, "UPDATE settings SET value = '24' WHERE key = 'cod_confirm_hours'")
	number := placeOrder(t, "01712345601", "BALL-5", 1, now.Add(-25*time.Hour))
	if _, err := s.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	if status(t, number) != "CANCELLED" {
		t.Fatal("a 25-hour-old order should be cancelled when the setting is 24")
	}
	if r := queryString(t, "SELECT cancel_reason FROM orders WHERE order_number = $1", number); r != "Not confirmed by phone within 24 hours" {
		t.Errorf("reason = %q", r)
	}
}

func TestAutoCancelBringsSoldOutBack(t *testing.T) {
	s := setup(t)
	number := placeOrder(t, "01712345601", "DRN-01", 3, now.Add(-50*time.Hour)) // last 3 drones
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "SOLD_OUT" {
		t.Fatalf("drone = %s", st)
	}
	if _, err := s.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	if status(t, number) != "CANCELLED" {
		t.Fatal("order not cancelled")
	}
	if st := queryString(t, "SELECT status::text FROM products WHERE slug = 'midnight-circuit-desk-drone'"); st != "ACTIVE" {
		t.Fatalf("drone = %s, want ACTIVE again", st)
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'REACTIVATE' AND actor = 'SYSTEM'"); n != 1 {
		t.Errorf("REACTIVATE events = %d", n)
	}
}

func TestAutoArchive(t *testing.T) {
	s := setup(t)
	// Seed: Founders Deck sold out 2026-09-21, Mini Goal 2026-09-02 (both
	// SOLD_OUT, more than 7 days before "now"). Hoodie 01 is already ARCHIVED.
	// One more that sold out 6 days ago must stay SOLD_OUT.
	exec(t, "UPDATE products SET status = 'SOLD_OUT', sold_out_at = $1 WHERE slug = 'dragon-flame-playcard-set'", now.Add(-6*24*time.Hour))

	res, err := s.RunOnce(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if res.Archived != 2 {
		t.Fatalf("archived = %d, want 2", res.Archived)
	}
	for slug, want := range map[string]string{
		"founders-playcard-deck":        "ARCHIVED",
		"glow-arena-mini-goal":          "ARCHIVED",
		"dragon-flame-playcard-set":     "SOLD_OUT",
		"ember-night-hoodie-edition-01": "ARCHIVED",
	} {
		if got := queryString(t, "SELECT status::text FROM products WHERE slug = $1", slug); got != want {
			t.Errorf("%s = %s, want %s", slug, got, want)
		}
	}
	if n := queryInt(t, "SELECT count(*) FROM products WHERE slug = 'founders-playcard-deck' AND archived_at = $1", now); n != 1 {
		t.Error("archived_at should be the sweep time")
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'ARCHIVE' AND actor = 'SYSTEM'"); n != 2 {
		t.Errorf("ARCHIVE events = %d", n)
	}

	// A day later the 6-day one is past 7 days and moves too; the others do not repeat.
	s.Now = func() time.Time { return now.Add(25 * time.Hour) }
	res, err = s.RunOnce(context.Background())
	if err != nil || res.Archived != 1 {
		t.Fatalf("next day: %+v %v", res, err)
	}
	if n := queryInt(t, "SELECT count(*) FROM product_events WHERE type = 'ARCHIVE'"); n != 3 {
		t.Errorf("ARCHIVE events = %d, want 3", n)
	}
}

// Two sweeps at the same moment (two server instances): each order is
// cancelled once and its stock comes back once.
func TestConcurrentSweepsCancelOnce(t *testing.T) {
	s := setup(t)
	for i := range 5 {
		placeOrder(t, fmt.Sprintf("0171234560%d", i), "SLV-100", 2, now.Add(-49*time.Hour))
	}
	var wg sync.WaitGroup
	results := make([]Result, 2)
	errs := make([]error, 2)
	for i := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], errs[i] = s.RunOnce(context.Background())
		}()
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	if total := results[0].Cancelled + results[1].Cancelled; total != 5 {
		t.Fatalf("cancelled %d + %d, want 5 in total", results[0].Cancelled, results[1].Cancelled)
	}
	if n := queryInt(t, "SELECT stock FROM product_variants WHERE sku = 'SLV-100'"); n != 48 {
		t.Fatalf("stock = %d, want 48 (every piece back exactly once)", n)
	}
	if n := queryInt(t, "SELECT count(*) FROM inventory_movements WHERE reason = 'CANCEL'"); n != 5 {
		t.Fatalf("CANCEL movements = %d, want 5", n)
	}
}

func TestStartRunsImmediatelyAndStops(t *testing.T) {
	s := setup(t)
	number := placeOrder(t, "01712345601", "BALL-5", 1, now.Add(-49*time.Hour))
	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	s.Start(ctx, time.Hour, &wg)
	deadline := time.Now().Add(5 * time.Second)
	for status(t, number) != "CANCELLED" {
		if time.Now().After(deadline) {
			t.Fatal("the first sweep did not run at start")
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()
	wg.Wait() // returns: the loop stopped
}
