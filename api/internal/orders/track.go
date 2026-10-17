package orders

import (
	"context"
	"crypto/subtle"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// ErrNotFound is the one answer for a wrong number, a wrong phone or a
// wrong token, so nobody can find out which order numbers exist.
var ErrNotFound = errors.New("order not found")

// ErrCannotCancel: the order has shipped (or is already cancelled/delivered).
var ErrCannotCancel = errors.New("order can no longer be cancelled")

var orderNumberRe = regexp.MustCompile(`^DRK-[2-9A-HJ-NP-Z]{6}$`)

// Lookup finds an order: its number plus the phone it was placed with, or
// plus the secret token the browser saved after ordering.
type Lookup struct {
	OrderNumber string `json:"orderNumber"`
	Phone       string `json:"phone"`
	Token       string `json:"token"`
}

const maxCancelReasonRunes = 200

func (l *Lookup) clean() error {
	l.OrderNumber = strings.ToUpper(strings.TrimSpace(l.OrderNumber))
	l.Token = strings.TrimSpace(l.Token)
	if l.Phone == "" && l.Token == "" {
		return &InputError{Code: "BAD_LOOKUP", Message: "Send the order number with the phone number (or the token).",
			Fields: map[string]string{"phone": "Enter the phone number you ordered with."}}
	}
	if !orderNumberRe.MatchString(l.OrderNumber) {
		// Not even the right shape: it cannot exist. Same answer as "not found".
		return ErrNotFound
	}
	return nil
}

// matches checks the phone or the token in constant time (the time taken
// does not reveal how many characters were right).
func (l Lookup) matches(o db.GetOrderByNumberRow) bool {
	if l.Token != "" {
		return subtle.ConstantTimeCompare(HashToken(l.Token), o.TrackTokenHash) == 1
	}
	return subtle.ConstantTimeCompare([]byte(NormalizePhone(l.Phone)), []byte(o.Phone)) == 1
}

func find(ctx context.Context, q *db.Queries, l Lookup) (db.GetOrderByNumberRow, error) {
	o, err := q.GetOrderByNumber(ctx, l.OrderNumber)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, ErrNotFound
	}
	if err != nil {
		return o, err
	}
	if !l.matches(o) {
		return o, ErrNotFound
	}
	return o, nil
}

// Track returns the order's timeline and items (no personal data).
func Track(ctx context.Context, pool *pgxpool.Pool, l Lookup) (*View, error) {
	if err := l.clean(); err != nil {
		return nil, err
	}
	q := db.New(pool)
	set, err := settings.Load(ctx, q)
	if err != nil {
		return nil, err
	}
	o, err := find(ctx, q, l)
	if err != nil {
		return nil, err
	}
	return buildView(ctx, q, o, set)
}

// Cancel lets the buyer cancel while the order is PENDING or CONFIRMED.
// The stock goes back, in the same transaction.
func Cancel(ctx context.Context, pool *pgxpool.Pool, l Lookup, reason string, now time.Time) (*View, error) {
	if err := l.clean(); err != nil {
		return nil, err
	}
	reason = strings.TrimSpace(reason)
	if utf8.RuneCountInString(reason) > maxCancelReasonRunes {
		return nil, &InputError{Code: "VALIDATION", Message: "Keep the reason short.",
			Fields: map[string]string{"reason": "Keep the reason under 200 characters."}}
	}
	note := "Cancelled by the buyer"
	if reason != "" {
		note += ": " + reason
	}

	q := db.New(pool)
	set, err := settings.Load(ctx, q)
	if err != nil {
		return nil, err
	}
	var view *View
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		qtx := q.WithTx(tx)
		o, err := find(ctx, qtx, l)
		if err != nil {
			return err
		}
		cancelled, err := CancelLocked(ctx, qtx, o.ID, cancellable, db.ActorTypeCUSTOMER, nil, note, now)
		if err != nil {
			return err
		}
		if !cancelled {
			return ErrCannotCancel
		}
		view, err = loadView(ctx, qtx, o.OrderNumber, set)
		return err
	})
	if err != nil {
		return nil, err
	}
	return view, nil
}

// CancelLocked cancels one order inside the caller's transaction:
//   - locks the order row (FOR UPDATE) and re-reads its status
//   - does nothing (false) if allowed(status) says no, so it is safe to run twice
//   - sets CANCELLED with the reason, adds a history row
//   - puts every item's stock back (inventory_movements CANCEL)
//   - a SOLD_OUT product that has stock again becomes ACTIVE (product_events)
//
// The buyer's cancel, the auto-cancel sweep and the admin all use it.
// adminID is the admin who cancelled (nil for the buyer or the server); it
// goes on the history, stock and product event rows.
func CancelLocked(ctx context.Context, q *db.Queries, orderID int64, allowed func(db.OrderStatus) bool,
	actor db.ActorType, adminID *int64, reason string, now time.Time) (bool, error) {
	o, err := q.GetOrderForUpdate(ctx, orderID)
	if err != nil {
		return false, err
	}
	if !allowed(o.Status) {
		return false, nil
	}
	if err := q.SetOrderCancelled(ctx, db.SetOrderCancelledParams{ID: orderID, At: &now, Reason: &reason}); err != nil {
		return false, err
	}
	from := o.Status
	if err := q.InsertStatusHistory(ctx, db.InsertStatusHistoryParams{
		OrderID: orderID, FromStatus: &from, ToStatus: db.OrderStatusCANCELLED, Actor: actor, Note: reason, At: now,
		ByAdminID: adminID,
	}); err != nil {
		return false, err
	}

	items, err := q.ListOrderItems(ctx, orderID)
	if err != nil {
		return false, err
	}
	products := map[int64]bool{}
	for _, it := range items {
		if err := q.IncrementStock(ctx, db.IncrementStockParams{Qty: it.Qty, ID: it.VariantID}); err != nil {
			return false, err
		}
		if err := q.InsertInventoryMovement(ctx, db.InsertInventoryMovementParams{
			VariantID: it.VariantID, Change: it.Qty, Reason: db.InventoryReasonCANCEL, OrderID: &orderID,
			Note: "Order cancelled", ByAdminID: adminID,
		}); err != nil {
			return false, err
		}
		products[it.ProductID] = true
	}
	for productID := range products {
		_, err := q.ReactivateIfStocked(ctx, db.ReactivateIfStockedParams{ID: productID, At: now})
		if errors.Is(err, pgx.ErrNoRows) {
			continue // was not SOLD_OUT
		}
		if err != nil {
			return false, err
		}
		old, next := string(db.ProductStatusSOLDOUT), string(db.ProductStatusACTIVE)
		if err := q.InsertProductEvent(ctx, db.InsertProductEventParams{
			ProductID: productID, Type: db.ProductEventTypeREACTIVATE, Actor: actor,
			Reason: "Stock came back from a cancelled order", OldValue: &old, NewValue: &next, At: now,
			ByAdminID: adminID,
		}); err != nil {
			return false, err
		}
	}
	return true, nil
}
