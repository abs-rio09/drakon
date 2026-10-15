// Package orders holds the checkout rules: pricing a cart, placing a Cash on
// Delivery order, tracking and cancelling it. The server decides every
// number here from the database; nothing the browser says about prices is
// trusted (CLAUDE.md hard rule 1).
package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// Cart size bounds. They only stop silly requests; the purchase limit and
// stock are the real business limits.
const (
	MaxLines   = 50
	MaxLineQty = 99
)

// Line is one cart line as the browser sends it: which variant, how many.
type Line struct {
	VariantID int64 `json:"variantId"`
	Qty       int   `json:"qty"`
}

// Problem codes. The website shows the message next to the item.
const (
	ProblemUnknown     = "UNKNOWN_VARIANT"  // no such variant, or not public: drop it quietly
	ProblemUnavailable = "UNAVAILABLE"      // sold out run in the archive
	ProblemOutOfStock  = "OUT_OF_STOCK"     // stock 0 right now
	ProblemNotEnough   = "NOT_ENOUGH_STOCK" // fewer left than asked for
	ProblemOverLimit   = "OVER_LIMIT"       // more than the purchase limit for this product
)

type Problem struct {
	VariantID int64  `json:"variantId"`
	Code      string `json:"code"`
	Message   string `json:"message"`
}

type Item struct {
	VariantID      int64  `json:"variantId"`
	ProductID      int64  `json:"productId"`
	ProductSlug    string `json:"productSlug"`
	ProductName    string `json:"productName"`
	VariantName    string `json:"variantName"` // "Size M", "Metal"
	Thumb          string `json:"thumb"`
	UnitPricePaisa int64  `json:"unitPricePaisa"`
	Qty            int    `json:"qty"`
	LineTotalPaisa int64  `json:"lineTotalPaisa"`
	Stock          int    `json:"stock"`
	// MaxQty is the most of this variant one buyer may put in the cart:
	// the lower of stock and the product's purchase limit.
	MaxQty   int      `json:"maxQty"`
	Problem  *Problem `json:"problem"`
	Currency string   `json:"currency"`

	// Not sent to the browser; used when the order is written.
	variantLabel string
	isLimited    bool
}

// Delivery is the charge for the chosen area.
type Delivery struct {
	AreaID       int64   `json:"areaId"`
	District     string  `json:"district"`
	AreaLabel    string  `json:"areaLabel"`
	ZoneCode     string  `json:"zoneCode"`
	ChargePaisa  int64   `json:"chargePaisa"` // after free delivery
	FreeDelivery bool    `json:"freeDelivery"`
	districtArea *string // "Dhaka city" when the district has a choice, else nil
}

type Quote struct {
	Items         []Item    `json:"items"`
	Problems      []Problem `json:"problems"`
	SubtotalPaisa int64     `json:"subtotalPaisa"`
	Delivery      *Delivery `json:"delivery"`   // nil until an area is chosen
	TotalPaisa    *int64    `json:"totalPaisa"` // nil until an area is chosen
	Currency      string    `json:"currency"`
}

// OK reports whether the cart can be ordered as it is.
func (q Quote) OK() bool { return len(q.Problems) == 0 && len(q.Items) > 0 }

// InputError is a problem with what the browser sent (400/422 answers).
type InputError struct {
	Code    string
	Message string
	Fields  map[string]string
}

func (e *InputError) Error() string { return e.Code + ": " + e.Message }

// Querier is the subset of *db.Queries that pricing needs.
type Querier interface {
	GetVariantsForCheckout(ctx context.Context, ids []int64) ([]db.GetVariantsForCheckoutRow, error)
	GetDeliveryArea(ctx context.Context, id int64) (db.GetDeliveryAreaRow, error)
}

// normalizeLines checks the cart's shape and merges repeated variants.
func normalizeLines(lines []Line) ([]Line, error) {
	if len(lines) == 0 {
		return nil, &InputError{Code: "EMPTY_CART", Message: "The cart is empty."}
	}
	if len(lines) > MaxLines {
		return nil, &InputError{Code: "CART_TOO_LARGE", Message: fmt.Sprintf("A cart can have at most %d different items.", MaxLines)}
	}
	merged := []Line{}
	index := map[int64]int{}
	for _, l := range lines {
		if l.VariantID <= 0 || l.Qty < 1 || l.Qty > MaxLineQty {
			return nil, &InputError{Code: "BAD_CART", Message: fmt.Sprintf("Each cart line needs a variantId and a qty from 1 to %d.", MaxLineQty)}
		}
		if i, seen := index[l.VariantID]; seen {
			merged[i].Qty += l.Qty
			continue
		}
		index[l.VariantID] = len(merged)
		merged = append(merged, l)
	}
	return merged, nil
}

// buildQuote is the pure pricing logic (no database), so it is easy to test.
// earlier maps product id -> pieces this phone already has in non-cancelled
// orders (empty for a quote, filled when an order is placed).
func buildQuote(lines []Line, rows []db.GetVariantsForCheckoutRow, set settings.Settings, earlier map[int64]int) Quote {
	byID := make(map[int64]db.GetVariantsForCheckoutRow, len(rows))
	for _, r := range rows {
		byID[r.VariantID] = r
	}

	quote := Quote{Items: []Item{}, Problems: []Problem{}, Currency: "BDT"}
	// Pieces of each product in this cart, for the purchase limit. Lines
	// that cannot be bought anyway (sold out, stock 0) do not count.
	perProduct := map[int64]int{}
	for _, l := range lines {
		if r, ok := byID[l.VariantID]; ok && r.IsActive && r.ProductStatus == db.ProductStatusACTIVE && r.Stock > 0 {
			perProduct[r.ProductID] += l.Qty
		}
	}

	for _, l := range lines {
		r, ok := byID[l.VariantID]
		if !ok || !r.IsActive || r.ProductStatus == db.ProductStatusDRAFT {
			quote.Problems = append(quote.Problems, Problem{VariantID: l.VariantID, Code: ProblemUnknown, Message: "This item is no longer available."})
			continue
		}
		limit := set.DefaultPurchaseLimit
		if r.PurchaseLimit != nil {
			limit = int(*r.PurchaseLimit)
		}
		item := Item{
			VariantID: r.VariantID, ProductID: r.ProductID, ProductSlug: r.ProductSlug, ProductName: r.ProductName,
			VariantName: VariantName(r.VariantKind, r.Label), Thumb: r.Thumb,
			UnitPricePaisa: r.PricePaisa, Qty: l.Qty, LineTotalPaisa: r.PricePaisa * int64(l.Qty),
			Stock: int(r.Stock), MaxQty: min(int(r.Stock), limit), Currency: r.Currency,
			variantLabel: r.Label, isLimited: r.IsLimited,
		}

		var p *Problem
		switch {
		case r.ProductStatus == db.ProductStatusSOLDOUT || r.ProductStatus == db.ProductStatusARCHIVED:
			p = &Problem{Code: ProblemUnavailable, Message: "This run sold out and is in the archive."}
		case r.Stock == 0:
			p = &Problem{Code: ProblemOutOfStock, Message: "Out of stock."}
		case int(r.Stock) < l.Qty:
			p = &Problem{Code: ProblemNotEnough, Message: fmt.Sprintf("Only %d left.", r.Stock)}
		case perProduct[r.ProductID]+earlier[r.ProductID] > limit:
			msg := fmt.Sprintf("The limit is %d per customer for this product.", limit)
			if earlier[r.ProductID] > 0 {
				msg = fmt.Sprintf("The limit is %d per customer, and this phone number already has %d in other orders.", limit, earlier[r.ProductID])
			}
			p = &Problem{Code: ProblemOverLimit, Message: msg}
		}
		if p != nil {
			p.VariantID = r.VariantID
			item.Problem = p
			quote.Problems = append(quote.Problems, *p)
		}
		// Sold out items are shown but do not count towards the subtotal.
		if p == nil || p.Code == ProblemNotEnough || p.Code == ProblemOverLimit {
			quote.SubtotalPaisa += item.LineTotalPaisa
		}
		quote.Items = append(quote.Items, item)
	}
	return quote
}

// applyDelivery adds the delivery charge for the chosen area and the total.
func applyDelivery(quote *Quote, area db.GetDeliveryAreaRow, set settings.Settings) {
	charge := area.ChargePaisa
	free := set.FreeDeliveryEnabled && area.FreeOverPaisa != nil && quote.SubtotalPaisa >= *area.FreeOverPaisa
	if free {
		charge = 0
	}
	d := &Delivery{
		AreaID: area.ID, District: area.District, AreaLabel: area.AreaLabel, ZoneCode: area.ZoneCode,
		ChargePaisa: charge, FreeDelivery: free,
	}
	if area.AreasInDistrict > 1 {
		label := area.AreaLabel
		d.districtArea = &label
	}
	quote.Delivery = d
	total := quote.SubtotalPaisa + charge
	quote.TotalPaisa = &total
}

// BuildQuote prices a cart for display: stock, limits and the delivery
// charge. areaID may be nil (no area chosen yet).
func BuildQuote(ctx context.Context, q Querier, set settings.Settings, lines []Line, areaID *int64) (Quote, error) {
	lines, err := normalizeLines(lines)
	if err != nil {
		return Quote{}, err
	}
	return quoteWith(ctx, q, set, lines, areaID, nil)
}

func quoteWith(ctx context.Context, q Querier, set settings.Settings, lines []Line, areaID *int64, earlier map[int64]int) (Quote, error) {
	ids := make([]int64, len(lines))
	for i, l := range lines {
		ids[i] = l.VariantID
	}
	rows, err := q.GetVariantsForCheckout(ctx, ids)
	if err != nil {
		return Quote{}, err
	}
	quote := buildQuote(lines, rows, set, earlier)
	if areaID != nil {
		area, err := q.GetDeliveryArea(ctx, *areaID)
		if errors.Is(err, pgx.ErrNoRows) {
			return Quote{}, &InputError{Code: "UNKNOWN_AREA", Message: "Choose your district (and area) again.",
				Fields: map[string]string{"district": "Choose your district."}}
		}
		if err != nil {
			return Quote{}, err
		}
		applyDelivery(&quote, area, set)
	}
	return quote, nil
}

// VariantName is how a variant is named in the cart and on the order:
// "Size M" for sizes, otherwise just the label ("Metal", "Standard").
// The website uses the same rule (web/src/lib/catalog.ts).
func VariantName(variantKind, label string) string {
	if variantKind == "Size" {
		return "Size " + label
	}
	return label
}
