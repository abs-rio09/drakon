package products

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/money"
)

// ConfirmedPrice is one price the admin saw on the "check the prices" screen.
type ConfirmedPrice struct {
	VariantID  int64 `json:"variantId"`
	PricePaisa int64 `json:"pricePaisa"`
}

// Publish moves a DRAFT to ACTIVE (on sale). It needs at least one photo
// and one active variant with a price, and the prices the admin confirmed
// must be exactly today's prices (if anything changed in between, the
// admin has to look again). After this, the prices are locked.
func Publish(ctx context.Context, pool *pgxpool.Pool, productID int64, confirmed []ConfirmedPrice, adminID int64, now time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		p, err := q.LockProduct(ctx, productID)
		if err != nil {
			return notFoundAs(err, errNoProduct)
		}
		if p.Status != db.ProductStatusDRAFT {
			return refuse("NOT_DRAFT", "Only a draft can be published.")
		}
		full, err := Load(ctx, q, productID)
		if err != nil {
			return err
		}
		if problems := publishProblems(full); len(problems) > 0 {
			return refuse("CANNOT_PUBLISH", strings.Join(problems, " "))
		}
		// The prices on the confirm screen must be the prices going live.
		want := map[int64]int64{}
		for _, v := range full.Variants {
			if v.IsActive {
				want[v.ID] = v.PricePaisa
			}
		}
		got := map[int64]int64{}
		for _, c := range confirmed {
			got[c.VariantID] = c.PricePaisa
		}
		if len(got) != len(want) {
			return refuse("PRICES_CHANGED", "The prices changed since you checked them. Look at them again.")
		}
		for id, price := range want {
			if got[id] != price {
				return refuse("PRICES_CHANGED", "The prices changed since you checked them. Look at them again.")
			}
		}

		if err := q.SetProductStatus(ctx, db.SetProductStatusParams{ID: productID, Status: db.ProductStatusACTIVE, At: now}); err != nil {
			return err
		}
		return event(ctx, q, productID, db.ProductEventTypePUBLISH, priceList(full),
			strp(string(db.ProductStatusDRAFT)), strp(string(db.ProductStatusACTIVE)), adminID, now)
	})
}

// priceList: "Published at HD02-S ৳2,450, HD02-M ৳2,450" (kept in the event,
// in taka like the PRICE_FIX record; rows from before 2026-10-25 keep
// their raw paisa text).
func priceList(p *Product) string {
	parts := []string{}
	for _, v := range p.Variants {
		if v.IsActive {
			parts = append(parts, v.SKU+" "+money.Taka(v.PricePaisa))
		}
	}
	return "Published at " + strings.Join(parts, ", ")
}

// Archive moves a SOLD_OUT product to ARCHIVED by hand (the sweep does it
// by itself after archive_after_days).
func Archive(ctx context.Context, pool *pgxpool.Pool, productID int64, reason string, adminID int64, now time.Time) error {
	reason = strings.TrimSpace(reason)
	if runes(reason) > maxReasonRunes {
		return invalid(map[string]string{"reason": "Keep the reason shorter."})
	}
	if reason == "" {
		reason = "Archived by hand"
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		p, err := q.LockProduct(ctx, productID)
		if err != nil {
			return notFoundAs(err, errNoProduct)
		}
		if p.Status != db.ProductStatusSOLDOUT {
			return refuse("NOT_SOLD_OUT", "Only a sold-out product can be archived.")
		}
		cur, err := q.GetAdminProduct(ctx, productID)
		if err != nil {
			return err
		}
		if err := q.SetProductStatus(ctx, db.SetProductStatusParams{
			ID: productID, Status: db.ProductStatusARCHIVED, SoldOutAt: cur.SoldOutAt, ArchivedAt: &now, At: now,
		}); err != nil {
			return err
		}
		return event(ctx, q, productID, db.ProductEventTypeARCHIVE, reason,
			strp(string(db.ProductStatusSOLDOUT)), strp(string(db.ProductStatusARCHIVED)), adminID, now)
	})
}

// minReactivateRunes: bringing an archived run back is the Owner's
// exception to "limited means limited", so it needs a real reason.
const minReactivateRunes = 10

// Reactivate brings an ARCHIVED product back on sale (Owner only, with a
// written reason, recorded as a REACTIVATE event). Use it for real
// exceptions: a limited run that comes back can be restocked again.
func Reactivate(ctx context.Context, pool *pgxpool.Pool, productID int64, reason string, adminID int64, now time.Time) error {
	reason = strings.TrimSpace(reason)
	switch {
	case runes(reason) < minReactivateRunes:
		return invalid(map[string]string{"reason": "Write why this product comes back (at least 10 characters). It is saved in the record."})
	case runes(reason) > maxReasonRunes:
		return invalid(map[string]string{"reason": "Keep the reason shorter."})
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		p, err := q.LockProduct(ctx, productID)
		if err != nil {
			return notFoundAs(err, errNoProduct)
		}
		if p.Status != db.ProductStatusARCHIVED {
			return refuse("NOT_ARCHIVED", "Only an archived product can be brought back.")
		}
		if err := q.SetProductStatus(ctx, db.SetProductStatusParams{ID: productID, Status: db.ProductStatusACTIVE, At: now}); err != nil {
			return err
		}
		return event(ctx, q, productID, db.ProductEventTypeREACTIVATE, reason,
			strp(string(db.ProductStatusARCHIVED)), strp(string(db.ProductStatusACTIVE)), adminID, now)
	})
}
