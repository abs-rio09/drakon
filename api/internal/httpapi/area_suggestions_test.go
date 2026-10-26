package httpapi

import (
	"context"
	"net/http"
	"slices"
	"testing"
)

// The data in migration 00010 must fit our districts: every delivery area
// gets at least one suggestion, and no suggestion names a district (or a
// Dhaka card) that does not exist. Fails if a district name is misspelled.
func TestAreaSuggestionsMatchDistricts(t *testing.T) {
	newTestServer(t, false)
	ctx := context.Background()

	var unknown []string
	rows, err := testDB.Pool.Query(ctx, `
		SELECT DISTINCT s.district FROM area_suggestions s
		WHERE NOT EXISTS (SELECT 1 FROM delivery_areas a WHERE a.district = s.district)`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			t.Fatal(err)
		}
		unknown = append(unknown, d)
	}
	if rows.Err() != nil || len(unknown) > 0 {
		t.Fatalf("suggestions for unknown districts: %v %v", unknown, rows.Err())
	}

	var wrongCard int
	if err := testDB.Pool.QueryRow(ctx, `
		SELECT count(*) FROM area_suggestions s
		JOIN delivery_areas a ON a.id = s.city_area_id
		WHERE a.district <> s.district`).Scan(&wrongCard); err != nil || wrongCard != 0 {
		t.Fatalf("%d suggestions point at another district's area (%v)", wrongCard, err)
	}

	var empty []string
	rows, err = testDB.Pool.Query(ctx, `
		SELECT a.district || ' / ' || a.area_label FROM delivery_areas a
		WHERE NOT EXISTS (
			SELECT 1 FROM area_suggestions s
			WHERE s.district = a.district AND (s.city_area_id IS NULL OR s.city_area_id = a.id))`)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			t.Fatal(err)
		}
		empty = append(empty, d)
	}
	if rows.Err() != nil || len(empty) > 0 {
		t.Fatalf("delivery areas without suggestions: %v %v", empty, rows.Err())
	}
}

// areaSuggestions returns the suggestions of one district's area from
// GET /api/delivery/areas.
func areaSuggestions(t *testing.T, body map[string]any, district, label string) []string {
	t.Helper()
	for _, d := range list(body, "districts") {
		m := d.(map[string]any)
		if m["name"] != district {
			continue
		}
		for _, a := range m["areas"].([]any) {
			am := a.(map[string]any)
			if am["label"] != label {
				continue
			}
			out := []string{}
			for _, s := range am["suggestions"].([]any) {
				out = append(out, s.(string))
			}
			return out
		}
	}
	t.Fatalf("no area %s / %s", district, label)
	return nil
}

func TestDeliveryAreasCarrySuggestions(t *testing.T) {
	s := newTestServer(t, false)
	_, body := do(t, s, http.MethodGet, "/api/delivery/areas", nil)

	sylhet := areaSuggestions(t, body, "Sylhet", "Sylhet")
	if !slices.Contains(sylhet, "Beanibazar") || slices.Contains(sylhet, "Savar") {
		t.Fatalf("Sylhet: %v", sylhet)
	}
	city := areaSuggestions(t, body, "Dhaka", "Dhaka city")
	outside := areaSuggestions(t, body, "Dhaka", "Outside Dhaka city")
	if len(city) != 50 || !slices.Contains(city, "Mirpur Model") || slices.Contains(city, "Savar") {
		t.Fatalf("Dhaka city: %d %v", len(city), city)
	}
	if !slices.Equal(outside, []string{"Dhamrai", "Dohar", "Keraniganj", "Nawabganj", "Savar"}) {
		t.Fatalf("Outside Dhaka city: %v", outside)
	}
	if got := areaSuggestions(t, body, "Cox's Bazar", "Cox's Bazar"); !slices.Contains(got, "Teknaf") {
		t.Fatalf("Cox's Bazar: %v", got)
	}

	// A name the Owner turned off is no longer suggested.
	if _, err := testDB.Pool.Exec(context.Background(),
		`UPDATE area_suggestions SET is_active = false WHERE district = 'Sylhet' AND name = 'Beanibazar'`); err != nil {
		t.Fatal(err)
	}
	_, body = do(t, s, http.MethodGet, "/api/delivery/areas", nil)
	if slices.Contains(areaSuggestions(t, body, "Sylhet", "Sylhet"), "Beanibazar") {
		t.Fatal("inactive suggestion is still listed")
	}
}
