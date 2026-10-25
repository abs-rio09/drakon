package products

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
)

// VariantInput is one variant (size, material ...) with its own price.
type VariantInput struct {
	SKU        string `json:"sku"`
	Label      string `json:"label"`
	Note       string `json:"note"`
	PricePaisa int64  `json:"pricePaisa"`
	ImageIndex *int32 `json:"imageIndex"` // which photo shows it (0 = first)
	SortOrder  int32  `json:"sortOrder"`
	IsActive   *bool  `json:"isActive"` // off = hidden from the shop (never deleted); null = unchanged
	// Reason is needed only for a new variant on a product that is no
	// longer a draft: it sets a new price, like a price fix (open question 19).
	Reason string `json:"reason"`
}

const (
	// MaxPricePaisa: ৳10,00,000. Only stops typing mistakes (an extra zero).
	MaxPricePaisa  = 100_000_000
	maxLabelRunes  = 60
	maxNoteRunes   = 120
	maxStockChange = 100_000
	minReasonRunes = 5
	maxReasonRunes = 300
)

var skuRe = regexp.MustCompile(`^[A-Z0-9][A-Z0-9-]{1,39}$`)

func (in *VariantInput) clean() map[string]string {
	f := map[string]string{}
	in.SKU = strings.ToUpper(strings.TrimSpace(in.SKU))
	in.Label = strings.TrimSpace(in.Label)
	in.Note = strings.TrimSpace(in.Note)
	if !skuRe.MatchString(in.SKU) {
		f["sku"] = "Use 2 to 40 capital letters, numbers and dashes, like HD02-M."
	}
	switch {
	case in.Label == "":
		f["label"] = "Name the option, like M or Metal."
	case runes(in.Label) > maxLabelRunes:
		f["label"] = "Keep the option name short."
	}
	if runes(in.Note) > maxNoteRunes {
		f["note"] = "Keep the note to one short line."
	}
	if in.PricePaisa <= 0 || in.PricePaisa > MaxPricePaisa {
		f["pricePaisa"] = "Enter a price above ৳0 (and under ৳10,00,000)."
	}
	if in.ImageIndex != nil && *in.ImageIndex < 0 {
		f["imageIndex"] = "Choose one of the photos."
	}
	return f
}

// labelRepeatsKind refuses an option name that starts with the product's
// variant kind ("Size M" when the kind is Size): the shop already puts
// the kind in front, which would show "Size Size M" (open question 21).
func labelRepeatsKind(label, kind string) string {
	kind = strings.TrimSpace(kind)
	if kind == "" {
		return ""
	}
	first, rest, _ := strings.Cut(label, " ")
	if !strings.EqualFold(strings.TrimRight(first, ":-"), kind) || strings.TrimSpace(rest) == "" {
		return ""
	}
	return fmt.Sprintf("Leave out the word “%s”: type %s. The shop already shows the kind (%s) with it.",
		kind, strings.TrimSpace(rest), kind)
}

func checkImageIndex(ctx context.Context, q *db.Queries, productID int64, idx *int32) error {
	if idx == nil {
		return nil
	}
	n, err := q.CountProductImages(ctx, productID)
	if err != nil {
		return err
	}
	if *idx >= n {
		return invalid(map[string]string{"imageIndex": "Choose one of the product's photos."})
	}
	return nil
}

// AddVariant adds a variant. It starts with stock 0: stock always comes in
// through ChangeStock, so every piece has a line in the stock book.
// On a product that has left DRAFT the new price did not go through the
// publish check, so it needs a written reason and leaves a PRICE_FIX
// record (no old price, the new price) with the admin's id.
func AddVariant(ctx context.Context, pool *pgxpool.Pool, productID int64, in VariantInput, adminID int64, now time.Time) (int64, error) {
	if f := in.clean(); len(f) > 0 {
		return 0, invalid(f)
	}
	in.Reason = strings.TrimSpace(in.Reason)
	var id int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		p, err := q.LockProduct(ctx, productID)
		if err != nil {
			return notFoundAs(err, errNoProduct)
		}
		if p.Status == db.ProductStatusARCHIVED {
			return refuse("ARCHIVED", "An archived product cannot get new variants.")
		}
		if problem := labelRepeatsKind(in.Label, p.VariantKind); problem != "" {
			return invalid(map[string]string{"label": problem})
		}
		live := p.Status != db.ProductStatusDRAFT
		if live {
			switch {
			case runes(in.Reason) < minReasonRunes:
				return invalid(map[string]string{"reason": "The product is live: write why it gets a new option at this price (at least 5 characters). It is saved in the record."})
			case runes(in.Reason) > maxReasonRunes:
				return invalid(map[string]string{"reason": "Keep the reason shorter."})
			}
		}
		if err := checkImageIndex(ctx, q, productID, in.ImageIndex); err != nil {
			return err
		}
		id, err = q.InsertVariant(ctx, db.InsertVariantParams{
			ProductID: productID, Sku: in.SKU, Label: in.Label, Note: in.Note, PricePaisa: in.PricePaisa,
			ImageIndex: in.ImageIndex, SortOrder: in.SortOrder,
		})
		if err != nil {
			return uniqueError(err)
		}
		if live {
			price := strconv.FormatInt(in.PricePaisa, 10)
			if err := event(ctx, q, productID, db.ProductEventTypePRICEFIX, "New variant "+in.SKU+": "+in.Reason, nil, &price, adminID, now); err != nil {
				return err
			}
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: productID, At: now})
	})
	return id, err
}

// UpdateVariant saves a variant's label, note, photo, order and on/off.
// The price and the SKU can change only while the product is a DRAFT; on a
// live product the price changes only through PriceFix.
// Turning a variant off or on re-checks the product like a stock change
// does (open question 20): a limited ACTIVE product with nothing left on
// sale becomes SOLD_OUT, a SOLD_OUT product with stock again becomes ACTIVE.
func UpdateVariant(ctx context.Context, pool *pgxpool.Pool, variantID int64, in VariantInput, adminID int64, now time.Time) (int64, error) {
	if f := in.clean(); len(f) > 0 {
		return 0, invalid(f)
	}
	var productID int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		v, err := q.LockVariant(ctx, variantID)
		if err != nil {
			return notFoundAs(err, errNoVariant)
		}
		productID = v.ProductID
		p, err := q.LockProduct(ctx, v.ProductID)
		if err != nil {
			return err
		}
		if problem := labelRepeatsKind(in.Label, p.VariantKind); problem != "" {
			return invalid(map[string]string{"label": problem})
		}
		if p.Status != db.ProductStatusDRAFT {
			if in.PricePaisa != v.PricePaisa {
				return refuse("PRICE_LOCKED", "The price is locked because the product is live. Use “Owner price fix” with a reason.")
			}
			if in.SKU != v.Sku {
				return refuse("LOCKED", "The SKU is locked because the product is live.")
			}
		}
		if err := checkImageIndex(ctx, q, v.ProductID, in.ImageIndex); err != nil {
			return err
		}
		active := v.IsActive // not sent = keep it as it is
		if in.IsActive != nil {
			active = *in.IsActive
		}
		if err := q.UpdateVariant(ctx, db.UpdateVariantParams{
			ID: variantID, Sku: in.SKU, Label: in.Label, Note: in.Note, PricePaisa: in.PricePaisa,
			ImageIndex: in.ImageIndex, SortOrder: in.SortOrder, IsActive: active,
		}); err != nil {
			return uniqueError(err)
		}
		if active != v.IsActive {
			if err := recheckSoldOut(ctx, q, v.ProductID, v.Sku, active, adminID, now); err != nil {
				return err
			}
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: v.ProductID, At: now})
	})
	return productID, err
}

// recheckSoldOut runs after a variant was turned off (on = false) or on.
func recheckSoldOut(ctx context.Context, q *db.Queries, productID int64, sku string, on bool, adminID int64, now time.Time) error {
	if !on {
		_, err := q.MarkSoldOutIfEmpty(ctx, db.MarkSoldOutIfEmptyParams{ID: productID, At: &now})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // still something on sale, or not a limited ACTIVE product
		}
		if err != nil {
			return err
		}
		return event(ctx, q, productID, db.ProductEventTypeSOLDOUT, "Variant "+sku+" turned off: nothing left on sale",
			strp(string(db.ProductStatusACTIVE)), strp(string(db.ProductStatusSOLDOUT)), adminID, now)
	}
	_, err := q.ReactivateIfStocked(ctx, db.ReactivateIfStockedParams{ID: productID, At: now})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil // was not SOLD_OUT, or the variant has no stock
	}
	if err != nil {
		return err
	}
	return event(ctx, q, productID, db.ProductEventTypeREACTIVATE, "Variant "+sku+" turned on with stock",
		strp(string(db.ProductStatusSOLDOUT)), strp(string(db.ProductStatusACTIVE)), adminID, now)
}

// StockInput: POST /api/admin/variants/{id}/stock.
type StockInput struct {
	Change int32  `json:"change"` // +10 new pieces, -2 broken
	Reason string `json:"reason"` // RESTOCK (new pieces) or ADJUST (a correction)
	Note   string `json:"note"`   // why, in words (required)
}

// ChangeStock adds or removes pieces, with a line in the stock book
// (inventory_movements) that keeps the admin's id. The stock never goes
// below 0. A limited product that is SOLD_OUT or ARCHIVED never gets new
// pieces: that is the promise of a limited run.
func ChangeStock(ctx context.Context, pool *pgxpool.Pool, variantID int64, in StockInput, adminID int64, now time.Time) (int64, error) {
	in.Note = strings.TrimSpace(in.Note)
	reason := db.InventoryReason(strings.ToUpper(strings.TrimSpace(in.Reason)))
	f := map[string]string{}
	switch {
	case in.Change == 0:
		f["change"] = "Enter how many pieces to add (like 10) or take away (like -2)."
	case in.Change > maxStockChange || in.Change < -maxStockChange:
		f["change"] = "That is too many at once."
	}
	switch reason {
	case db.InventoryReasonRESTOCK:
		if in.Change < 0 {
			f["change"] = "A restock adds pieces. To take pieces away, choose Correction."
		}
	case db.InventoryReasonADJUST:
	default:
		f["reason"] = "Choose New stock (RESTOCK) or Correction (ADJUST)."
	}
	switch {
	case runes(in.Note) < minReasonRunes:
		f["note"] = "Write why the stock changes (at least 5 characters)."
	case runes(in.Note) > maxReasonRunes:
		f["note"] = "Keep the note shorter."
	}
	if len(f) > 0 {
		return 0, invalid(f)
	}

	var productID int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		// Variant first, then product: the same order as checkout, so the
		// two never wait for each other in a circle (deadlock).
		v, err := q.LockVariant(ctx, variantID)
		if err != nil {
			return notFoundAs(err, errNoVariant)
		}
		productID = v.ProductID
		p, err := q.LockProduct(ctx, v.ProductID)
		if err != nil {
			return err
		}
		if in.Change > 0 && p.IsLimited && (p.Status == db.ProductStatusSOLDOUT || p.Status == db.ProductStatusARCHIVED) {
			return refuse("LIMITED_NO_RESTOCK", "This is a limited run that has sold out. Limited runs are never restocked; that is what makes them limited.")
		}
		if _, err := q.ChangeStock(ctx, db.ChangeStockParams{ID: variantID, Change: in.Change}); errors.Is(err, pgx.ErrNoRows) {
			return refuse("STOCK_BELOW_ZERO", fmt.Sprintf("Only %d in stock, so you can take away at most %d.", v.Stock, v.Stock))
		} else if err != nil {
			return err
		}
		if err := q.InsertInventoryMovement(ctx, db.InsertInventoryMovementParams{
			VariantID: variantID, Change: in.Change, Reason: reason, Note: in.Note, ByAdminID: &adminID,
		}); err != nil {
			return err
		}
		// The last pieces of a limited run went away: it is now SOLD_OUT.
		if in.Change < 0 {
			_, err := q.MarkSoldOutIfEmpty(ctx, db.MarkSoldOutIfEmptyParams{ID: v.ProductID, At: &now})
			if err == nil {
				err = event(ctx, q, v.ProductID, db.ProductEventTypeSOLDOUT, "Stock corrected to 0: "+in.Note,
					strp(string(db.ProductStatusACTIVE)), strp(string(db.ProductStatusSOLDOUT)), adminID, now)
			} else if errors.Is(err, pgx.ErrNoRows) {
				err = nil // still has stock, or not a limited ACTIVE product
			}
			if err != nil {
				return err
			}
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: v.ProductID, At: now})
	})
	return productID, err
}

// PriceFixInput: POST /api/admin/variants/{id}/price-fix.
type PriceFixInput struct {
	PricePaisa int64  `json:"pricePaisa"`
	Reason     string `json:"reason"`
}

// PriceFix is the Owner's emergency price correction on a live (ACTIVE)
// product (blueprint rule 10). It needs a written reason and leaves a
// PRICE_FIX event with the old and the new price. Orders already placed
// keep the price they were placed at (order_items has its own copy).
func PriceFix(ctx context.Context, pool *pgxpool.Pool, variantID int64, in PriceFixInput, adminID int64, now time.Time) (int64, error) {
	in.Reason = strings.TrimSpace(in.Reason)
	f := map[string]string{}
	if in.PricePaisa <= 0 || in.PricePaisa > MaxPricePaisa {
		f["pricePaisa"] = "Enter a price above ৳0 (and under ৳10,00,000)."
	}
	switch {
	case runes(in.Reason) < minReasonRunes:
		f["reason"] = "Write why the price must change (at least 5 characters)."
	case runes(in.Reason) > maxReasonRunes:
		f["reason"] = "Keep the reason shorter."
	}
	if len(f) > 0 {
		return 0, invalid(f)
	}
	var productID int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		v, err := q.LockVariant(ctx, variantID)
		if err != nil {
			return notFoundAs(err, errNoVariant)
		}
		productID = v.ProductID
		p, err := q.LockProduct(ctx, v.ProductID)
		if err != nil {
			return err
		}
		switch {
		case p.Status == db.ProductStatusDRAFT:
			return refuse("NOT_LIVE", "This product is a draft: change the price in the variant itself.")
		case p.Status != db.ProductStatusACTIVE:
			return refuse("NOT_LIVE", "A price fix is only for products on sale (ACTIVE).")
		case in.PricePaisa == v.PricePaisa:
			return invalid(map[string]string{"pricePaisa": "This is already the price."})
		}
		if err := q.SetVariantPrice(ctx, db.SetVariantPriceParams{ID: variantID, PricePaisa: in.PricePaisa}); err != nil {
			return err
		}
		old, next := strconv.FormatInt(v.PricePaisa, 10), strconv.FormatInt(in.PricePaisa, 10)
		if err := event(ctx, q, v.ProductID, db.ProductEventTypePRICEFIX, v.Sku+": "+in.Reason, &old, &next, adminID, now); err != nil {
			return err
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: v.ProductID, At: now})
	})
	return productID, err
}
