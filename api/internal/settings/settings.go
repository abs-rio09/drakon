// Package settings reads the business numbers from the settings table.
// There are no fallback values in code: if a setting is missing, Load fails,
// so a wrong number can never be used silently (CLAUDE.md hard rule 3).
package settings

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/abs-rio09/drakon/api/internal/db"
)

type Settings struct {
	CodConfirmHours      int
	DefaultPurchaseLimit int
	ReturnDays           int
	ArchiveAfterDays     int
	FreeDeliveryEnabled  bool
	LowStockThreshold    int
	GiftNoteMaxChars     int
	CourierNoteMaxChars  int
	HomeHeroProductSlug  string
	LoginMaxFailures     int
	LoginLockoutMinutes  int
}

// Querier is the one sqlc method Load needs. *db.Queries has it, inside or
// outside a transaction.
type Querier interface {
	ListSettings(ctx context.Context) ([]db.ListSettingsRow, error)
}

func Load(ctx context.Context, q Querier) (Settings, error) {
	rows, err := q.ListSettings(ctx)
	if err != nil {
		return Settings{}, err
	}
	raw := make(map[string][]byte, len(rows))
	for _, r := range rows {
		raw[r.Key] = r.Value
	}

	var s Settings
	fields := []struct {
		key string
		dst any
	}{
		{"cod_confirm_hours", &s.CodConfirmHours},
		{"default_purchase_limit", &s.DefaultPurchaseLimit},
		{"return_days", &s.ReturnDays},
		{"archive_after_days", &s.ArchiveAfterDays},
		{"free_delivery_enabled", &s.FreeDeliveryEnabled},
		{"low_stock_threshold", &s.LowStockThreshold},
		{"gift_note_max_chars", &s.GiftNoteMaxChars},
		{"courier_note_max_chars", &s.CourierNoteMaxChars},
		{"home_hero_product_slug", &s.HomeHeroProductSlug},
		{"login_max_failures", &s.LoginMaxFailures},
		{"login_lockout_minutes", &s.LoginLockoutMinutes},
	}
	for _, f := range fields {
		value, ok := raw[f.key]
		if !ok {
			return Settings{}, fmt.Errorf("setting %q is missing from the settings table", f.key)
		}
		if err := json.Unmarshal(value, f.dst); err != nil {
			return Settings{}, fmt.Errorf("setting %q has the wrong type: %w", f.key, err)
		}
	}
	return s, nil
}
