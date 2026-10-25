package settings

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Rule says what the admin may put into one setting. Every key in the
// settings table has exactly one Rule (TestEverySettingHasARule).
type Rule struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Kind  string `json:"kind"` // "int", "bool" or "text"
	Min   int    `json:"min,omitempty"`
	Max   int    `json:"max,omitempty"`
	Unit  string `json:"unit,omitempty"` // "hours", "days" ...
}

// Rules are the sane limits for each business number. They stop typing
// mistakes (480 hours instead of 48), not business decisions.
var Rules = []Rule{
	{Key: "cod_confirm_hours", Label: "Hours to confirm a COD order by phone", Kind: "int", Min: 1, Max: 168, Unit: "hours"},
	{Key: "default_purchase_limit", Label: "Default purchase limit per product", Kind: "int", Min: 1, Max: 50, Unit: "pieces"},
	{Key: "return_days", Label: "Days after delivery to ask for a return", Kind: "int", Min: 0, Max: 30, Unit: "days"},
	{Key: "archive_after_days", Label: "Days a sold-out run stays before the archive", Kind: "int", Min: 0, Max: 90, Unit: "days"},
	{Key: "free_delivery_enabled", Label: "Free delivery over each zone's amount", Kind: "bool"},
	{Key: "low_stock_threshold", Label: "“Only a few left” starts at", Kind: "int", Min: 0, Max: 100, Unit: "pieces"},
	{Key: "gift_note_max_chars", Label: "Longest gift note", Kind: "int", Min: 20, Max: 500, Unit: "characters"},
	{Key: "courier_note_max_chars", Label: "Longest courier note", Kind: "int", Min: 20, Max: 500, Unit: "characters"},
	{Key: "home_hero_product_slug", Label: "Product under the home page photo", Kind: "text"},
	{Key: "login_max_failures", Label: "Wrong admin passwords before login pauses", Kind: "int", Min: 3, Max: 20, Unit: "tries"},
	{Key: "login_lockout_minutes", Label: "Minutes the admin login pauses", Kind: "int", Min: 1, Max: 1440, Unit: "minutes"},
	{Key: "rate_login_tries", Label: "Admin login tries per IP address", Kind: "int", Min: 1, Max: 100, Unit: "tries"},
	{Key: "rate_login_minutes", Label: "Admin login: window", Kind: "int", Min: 1, Max: 1440, Unit: "minutes"},
	{Key: "rate_order_tries", Label: "Orders per IP address", Kind: "int", Min: 1, Max: 1000, Unit: "tries"},
	{Key: "rate_order_minutes", Label: "Orders: window", Kind: "int", Min: 1, Max: 1440, Unit: "minutes"},
	{Key: "rate_track_tries", Label: "Order lookups (track) per IP address", Kind: "int", Min: 1, Max: 1000, Unit: "tries"},
	{Key: "rate_track_minutes", Label: "Order lookups (track): window", Kind: "int", Min: 1, Max: 1440, Unit: "minutes"},
	{Key: "rate_cancel_tries", Label: "Customer cancels per IP address", Kind: "int", Min: 1, Max: 1000, Unit: "tries"},
	{Key: "rate_cancel_minutes", Label: "Customer cancels: window", Kind: "int", Min: 1, Max: 1440, Unit: "minutes"},
}

// RuleFor returns the rule of a key.
func RuleFor(key string) (Rule, bool) {
	for _, r := range Rules {
		if r.Key == key {
			return r, true
		}
	}
	return Rule{}, false
}

// Check reads one value the admin sent and returns it as the JSON to store,
// or a problem in words.
func (r Rule) Check(raw json.RawMessage) (json.RawMessage, string) {
	switch r.Kind {
	case "int":
		var n int
		if err := json.Unmarshal(raw, &n); err != nil {
			return nil, "Enter a whole number."
		}
		if n < r.Min || n > r.Max {
			return nil, fmt.Sprintf("Use %d to %d %s.", r.Min, r.Max, r.Unit)
		}
		out, _ := json.Marshal(n)
		return out, ""
	case "bool":
		var b bool
		if err := json.Unmarshal(raw, &b); err != nil {
			return nil, "Choose on or off."
		}
		out, _ := json.Marshal(b)
		return out, ""
	default:
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, "Enter a text."
		}
		s = strings.TrimSpace(s)
		if len(s) > 200 {
			return nil, "This is too long."
		}
		out, _ := json.Marshal(s)
		return out, ""
	}
}
