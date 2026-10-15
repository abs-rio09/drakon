package orders

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// RefusedError means the order cannot be placed as it is: blocked phone,
// sold out, not enough stock, over the purchase limit. The website shows
// the message (and the problems next to the items).
type RefusedError struct {
	Code     string
	Message  string
	Problems []Problem
}

func (e *RefusedError) Error() string { return e.Code + ": " + e.Message }

// Placed is what the buyer gets back once, right after ordering.
type Placed struct {
	OrderNumber string `json:"orderNumber"`
	TrackToken  string `json:"trackToken"` // shown once; only its hash is stored
	Order       View   `json:"order"`
}

// maxNumberTries is how often we pick a new random order number if the
// one we picked already exists (practically never more than once).
const maxNumberTries = 5

// Place validates the checkout and creates a Cash on Delivery order in ONE
// transaction: either everything below happens, or nothing does.
func Place(ctx context.Context, pool *pgxpool.Pool, in Checkout, now time.Time) (*Placed, error) {
	q := db.New(pool)
	set, err := settings.Load(ctx, q)
	if err != nil {
		return nil, err
	}
	lines, err := normalizeLines(in.Items)
	if err != nil {
		return nil, err
	}
	if fields := in.Validate(set); len(fields) > 0 {
		return nil, &InputError{Code: "VALIDATION", Message: "Some details need fixing.", Fields: fields}
	}

	var placed *Placed
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		qtx := q.WithTx(tx)

		// 1. Same phone, same moment: wait for the other order to finish first.
		if err := qtx.LockPhone(ctx, in.Phone); err != nil {
			return err
		}
		blocked, err := qtx.IsPhoneBlocked(ctx, in.Phone)
		if err != nil {
			return err
		}
		if blocked {
			return &RefusedError{Code: "PHONE_BLOCKED", Message: "We can't take online orders for this phone number. Please contact us."}
		}

		// 2. Price everything from the database, with this phone's earlier
		//    orders counted towards the purchase limit.
		earlierRows, err := qtx.EarlierQtyByProduct(ctx, in.Phone)
		if err != nil {
			return err
		}
		earlier := map[int64]int{}
		for _, r := range earlierRows {
			earlier[r.ProductID] = int(r.Qty)
		}
		quote, err := quoteWith(ctx, qtx, set, lines, in.DeliveryAreaID, earlier)
		if err != nil {
			return err
		}
		if len(quote.Problems) > 0 {
			first := quote.Problems[0]
			return &RefusedError{Code: refusedCode(first.Code), Message: problemMessage(quote, first), Problems: quote.Problems}
		}

		// 3. Take the stock. Variants in id order, so two orders that share
		//    variants always lock them in the same order (no deadlock).
		items := slices.Clone(quote.Items)
		slices.SortFunc(items, func(a, b Item) int { return int(a.VariantID - b.VariantID) })
		for _, it := range items {
			n, err := qtx.DecrementStock(ctx, db.DecrementStockParams{Qty: int32(it.Qty), ID: it.VariantID})
			if err != nil {
				return err
			}
			if n == 0 {
				// Someone else bought the last pieces a moment ago.
				p := Problem{VariantID: it.VariantID, Code: ProblemNotEnough, Message: "Not enough left. Someone just bought it."}
				return &RefusedError{
					Code:     "OUT_OF_STOCK",
					Message:  fmt.Sprintf("%s (%s) just sold out. Please check your cart.", it.ProductName, it.VariantName),
					Problems: []Problem{p},
				}
			}
		}

		// 4. The order row, with a fresh random number.
		token, tokenHash := NewTrackToken()
		var email, giftName, giftPhone *string
		if in.Email != "" {
			email = &in.Email
		}
		if in.IsGift {
			giftName, giftPhone = &in.GiftName, &in.GiftPhone
		}
		d := quote.Delivery
		var orderID int64
		var number string
		for try := 0; ; try++ {
			if try == maxNumberTries {
				return errors.New("could not find a free order number")
			}
			number = NewOrderNumber()
			orderID, err = qtx.InsertOrder(ctx, db.InsertOrderParams{
				OrderNumber: number, TrackTokenHash: tokenHash,
				Name: in.Name, Phone: in.Phone, Email: email,
				DeliveryAreaID: d.AreaID, District: d.District, DistrictArea: d.districtArea,
				Area: in.Area, Address: in.Address, CourierNote: in.CourierNote,
				IsGift: in.IsGift, GiftReceiverName: giftName, GiftReceiverPhone: giftPhone,
				GiftNote: in.GiftNote, GiftHidePrices: in.HidePrices,
				ZoneCode: d.ZoneCode, DeliveryPaisa: d.ChargePaisa,
				SubtotalPaisa: quote.SubtotalPaisa, TotalPaisa: *quote.TotalPaisa, Currency: quote.Currency,
			})
			if errors.Is(err, pgx.ErrNoRows) {
				continue // that number is taken; pick another
			}
			if err != nil {
				return err
			}
			break
		}

		// 5. Items (snapshots of name and price) and the stock book.
		for _, it := range quote.Items {
			if err := qtx.InsertOrderItem(ctx, db.InsertOrderItemParams{
				OrderID: orderID, VariantID: it.VariantID, ProductID: it.ProductID,
				ProductName: it.ProductName, VariantLabel: it.VariantName,
				UnitPricePaisa: it.UnitPricePaisa, Qty: int32(it.Qty), LineTotalPaisa: it.LineTotalPaisa,
				Currency: it.Currency,
			}); err != nil {
				return err
			}
			if err := qtx.InsertInventoryMovement(ctx, db.InsertInventoryMovementParams{
				VariantID: it.VariantID, Change: -int32(it.Qty), Reason: db.InventoryReasonORDER,
				OrderID: &orderID, Note: "Order " + number,
			}); err != nil {
				return err
			}
		}

		// 6. Status history and the COD payment record.
		if err := qtx.InsertStatusHistory(ctx, db.InsertStatusHistoryParams{
			OrderID: orderID, ToStatus: db.OrderStatusPENDING, Actor: db.ActorTypeCUSTOMER,
			Note: "Order placed", At: now,
		}); err != nil {
			return err
		}
		if err := qtx.InsertPayment(ctx, db.InsertPaymentParams{
			OrderID: orderID, AmountPaisa: *quote.TotalPaisa, Currency: quote.Currency,
		}); err != nil {
			return err
		}

		// 7. A limited product with no stock left in any variant is now SOLD_OUT.
		if err := markSoldOut(ctx, qtx, quote.Items, now); err != nil {
			return err
		}

		view, err := loadView(ctx, qtx, number, set)
		if err != nil {
			return err
		}
		placed = &Placed{OrderNumber: number, TrackToken: token, Order: *view}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return placed, nil
}

func markSoldOut(ctx context.Context, q *db.Queries, items []Item, now time.Time) error {
	seen := map[int64]bool{}
	for _, it := range items {
		if seen[it.ProductID] || !it.isLimited {
			continue
		}
		seen[it.ProductID] = true
		_, err := q.MarkSoldOutIfEmpty(ctx, db.MarkSoldOutIfEmptyParams{ID: it.ProductID, At: &now})
		if errors.Is(err, pgx.ErrNoRows) {
			continue // still has stock
		}
		if err != nil {
			return err
		}
		old, next := string(db.ProductStatusACTIVE), string(db.ProductStatusSOLDOUT)
		if err := q.InsertProductEvent(ctx, db.InsertProductEventParams{
			ProductID: it.ProductID, Type: db.ProductEventTypeSOLDOUT, Actor: db.ActorTypeSYSTEM,
			Reason: "The last piece was ordered", OldValue: &old, NewValue: &next, At: now,
		}); err != nil {
			return err
		}
	}
	return nil
}

// refusedCode maps a cart problem to the order error code.
func refusedCode(problem string) string {
	switch problem {
	case ProblemOverLimit:
		return "PURCHASE_LIMIT"
	case ProblemUnknown, ProblemUnavailable:
		return "UNAVAILABLE"
	default:
		return "OUT_OF_STOCK"
	}
}

// problemMessage names the item: "Metal key-ring (Dragon Flame Card): Out of stock."
func problemMessage(q Quote, p Problem) string {
	for _, it := range q.Items {
		if it.VariantID == p.VariantID {
			return fmt.Sprintf("%s, %s: %s", it.ProductName, it.VariantName, p.Message)
		}
	}
	return p.Message
}
