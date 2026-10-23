package orders

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// Returns (docs/blueprint.md, part 2 rule 3):
//   - any reason, within return_days after delivery (a setting)
//   - the company's mistake (broken, wrong product, wrong size): the
//     company pays the delivery
//   - any other reason: the customer pays the delivery, and the pieces
//     must be unused, with tags, seal not opened
//   - the COD refund goes by hand (bKash / Nagad / cash) and is recorded

// ReturnItem is one order line coming back.
type ReturnItem struct {
	OrderItemID int64 `json:"orderItemId"`
	Qty         int32 `json:"qty"`
	Resellable  bool  `json:"resellable"` // back on the shelf (stock +qty)
}

// ReturnInput: POST /api/admin/orders/{number}/returns.
type ReturnInput struct {
	ReasonType       string       `json:"reasonType"`     // COMPANY_FAULT or OTHER
	Note             string       `json:"note"`           // what happened
	DeliveryPaidBy   string       `json:"deliveryPaidBy"` // COMPANY or CUSTOMER
	ConditionChecked bool         `json:"conditionChecked"`
	RefundPaisa      int64        `json:"refundPaisa"`
	RefundMethod     string       `json:"refundMethod"` // BKASH, NAGAD or CASH ("" when refund is 0)
	RefundRef        string       `json:"refundRef"`    // the bKash / Nagad transaction id
	Items            []ReturnItem `json:"items"`
}

// ReturnError: the return is refused by a rule (409), not a form mistake.
type ReturnError struct{ Code, Message string }

func (e *ReturnError) Error() string { return e.Code + ": " + e.Message }

const (
	maxReturnNoteRunes = 500
	maxRefundRefRunes  = 60
)

func (in *ReturnInput) clean() map[string]string {
	f := map[string]string{}
	in.ReasonType = strings.ToUpper(strings.TrimSpace(in.ReasonType))
	in.DeliveryPaidBy = strings.ToUpper(strings.TrimSpace(in.DeliveryPaidBy))
	in.RefundMethod = strings.ToUpper(strings.TrimSpace(in.RefundMethod))
	in.Note = strings.TrimSpace(in.Note)
	in.RefundRef = strings.TrimSpace(in.RefundRef)

	switch db.ReturnReason(in.ReasonType) {
	case db.ReturnReasonCOMPANYFAULT:
		if in.DeliveryPaidBy != string(db.DeliveryPayerCOMPANY) {
			f["deliveryPaidBy"] = "Our mistake: the company pays the delivery (return policy)."
		}
	case db.ReturnReasonOTHER:
		if !in.ConditionChecked {
			f["conditionChecked"] = "For other reasons the pieces must be unused, with tags, seal not opened. Check them first."
		}
	default:
		f["reasonType"] = "Choose “Our mistake” or “Other reason”."
	}
	if in.DeliveryPaidBy != string(db.DeliveryPayerCOMPANY) && in.DeliveryPaidBy != string(db.DeliveryPayerCUSTOMER) {
		f["deliveryPaidBy"] = "Choose who pays the delivery."
	}
	switch n := utf8.RuneCountInString(in.Note); {
	case n < 5:
		f["note"] = "Write what happened (at least 5 characters)."
	case n > maxReturnNoteRunes:
		f["note"] = "Keep the note shorter."
	}
	if in.RefundPaisa < 0 {
		f["refundPaisa"] = "The refund cannot be below ৳0."
	}
	if in.RefundPaisa > 0 {
		switch db.RefundMethod(in.RefundMethod) {
		case db.RefundMethodBKASH, db.RefundMethodNAGAD:
			if in.RefundRef == "" {
				f["refundRef"] = "Enter the transaction id of the bKash / Nagad payment."
			}
		case db.RefundMethodCASH:
		default:
			f["refundMethod"] = "Choose bKash, Nagad or cash."
		}
	} else {
		in.RefundMethod, in.RefundRef = "", ""
	}
	if utf8.RuneCountInString(in.RefundRef) > maxRefundRefRunes {
		f["refundRef"] = "The reference is too long."
	}
	if len(in.Items) == 0 {
		f["items"] = "Choose which pieces came back."
	}
	seen := map[int64]bool{}
	for _, it := range in.Items {
		if it.Qty <= 0 || seen[it.OrderItemID] {
			f["items"] = "Each line once, with at least 1 piece."
		}
		seen[it.OrderItemID] = true
	}
	return f
}

// RecordReturn saves a return in ONE transaction:
//   - the order must be DELIVERED, and within return_days of delivery
//   - no line returns more pieces than were bought (minus earlier returns)
//   - all refunds together never exceed the money collected
//   - resellable pieces go back to stock (inventory_movements RETURN with
//     the admin's id); a SOLD_OUT product with stock again becomes ACTIVE
//   - fully refunded: the payment becomes REFUNDED
func RecordReturn(ctx context.Context, pool *pgxpool.Pool, number string, in ReturnInput, adminID int64, now time.Time) error {
	if f := in.clean(); len(f) > 0 {
		return &InputError{Code: "VALIDATION", Message: "Some details need fixing.", Fields: f}
	}
	q := db.New(pool)
	set, err := settings.Load(ctx, q)
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		qtx := q.WithTx(tx)
		o, err := qtx.GetOrderByNumber(ctx, number)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		locked, err := qtx.GetOrderForReturn(ctx, o.ID)
		if err != nil {
			return err
		}
		if locked.Status != db.OrderStatusDELIVERED || locked.DeliveredAt == nil {
			return &ReturnError{Code: "NOT_DELIVERED", Message: "Only a delivered order can be returned."}
		}
		deadline := locked.DeliveredAt.Add(time.Duration(set.ReturnDays) * 24 * time.Hour)
		if now.After(deadline) {
			return &ReturnError{Code: "RETURN_WINDOW_OVER", Message: fmt.Sprintf(
				"Returns are open for %d days after delivery. This order was delivered on %s.",
				set.ReturnDays, locked.DeliveredAt.In(time.FixedZone("BST", 6*3600)).Format("2 Jan 2006"))}
		}

		// Pieces: never more than bought, minus what came back before.
		lines, err := qtx.OrderItemsForReturn(ctx, o.ID)
		if err != nil {
			return err
		}
		bought := map[int64]db.OrderItemsForReturnRow{}
		for _, l := range lines {
			bought[l.ID] = l
		}
		earlier, err := qtx.ReturnedQtyByOrderItem(ctx, o.ID)
		if err != nil {
			return err
		}
		returned := map[int64]int32{}
		for _, e := range earlier {
			returned[e.OrderItemID] = e.Qty
		}
		for _, it := range in.Items {
			l, ok := bought[it.OrderItemID]
			if !ok {
				return &InputError{Code: "VALIDATION", Message: "Some details need fixing.", Fields: map[string]string{"items": "A chosen line is not part of this order."}}
			}
			if left := l.Qty - returned[it.OrderItemID]; it.Qty > left {
				return &ReturnError{Code: "TOO_MANY_PIECES", Message: fmt.Sprintf("Only %d of this line can still come back.", left)}
			}
		}

		// Money: all refunds together never more than what was paid.
		pay, err := qtx.CollectedPayment(ctx, o.ID)
		if errors.Is(err, pgx.ErrNoRows) {
			return &ReturnError{Code: "NOT_PAID", Message: "No collected payment for this order."}
		}
		if err != nil {
			return err
		}
		before, err := qtx.RefundedSoFar(ctx, o.ID)
		if err != nil {
			return err
		}
		// Compare with what is left (not before+refund): a huge number
		// could wrap around int64 and look small.
		if in.RefundPaisa > pay.AmountPaisa-before {
			return &ReturnError{Code: "REFUND_TOO_HIGH", Message: fmt.Sprintf(
				"The refund cannot be more than was paid: ৳%s paid, ৳%s already refunded.", taka(pay.AmountPaisa), taka(before))}
		}

		var method *db.RefundMethod
		if in.RefundMethod != "" {
			m := db.RefundMethod(in.RefundMethod)
			method = &m
		}
		returnID, err := qtx.InsertReturn(ctx, db.InsertReturnParams{
			OrderID: o.ID, ReasonType: db.ReturnReason(in.ReasonType), Note: in.Note,
			DeliveryPaidBy: db.DeliveryPayer(in.DeliveryPaidBy), RefundPaisa: in.RefundPaisa,
			RefundMethod: method, RefundRef: in.RefundRef, ByAdminID: adminID, At: now,
		})
		if err != nil {
			return err
		}

		// Stock back, variants in id order (the same lock order as checkout).
		items := slices.Clone(in.Items)
		slices.SortFunc(items, func(a, b ReturnItem) int {
			return int(bought[a.OrderItemID].VariantID - bought[b.OrderItemID].VariantID)
		})
		products := map[int64]bool{}
		for _, it := range items {
			l := bought[it.OrderItemID]
			if err := qtx.InsertReturnItem(ctx, db.InsertReturnItemParams{
				ReturnID: returnID, OrderItemID: l.ID, VariantID: l.VariantID, Qty: it.Qty, Resellable: it.Resellable,
			}); err != nil {
				return err
			}
			if !it.Resellable {
				continue // damaged: it does not go back on the shelf
			}
			if err := qtx.IncrementStock(ctx, db.IncrementStockParams{ID: l.VariantID, Qty: it.Qty}); err != nil {
				return err
			}
			if err := qtx.InsertInventoryMovement(ctx, db.InsertInventoryMovementParams{
				VariantID: l.VariantID, Change: it.Qty, Reason: db.InventoryReasonRETURN, OrderID: &o.ID,
				Note: "Returned, can be sold again", ByAdminID: &adminID,
			}); err != nil {
				return err
			}
			products[l.ProductID] = true
		}
		for productID := range products {
			_, err := qtx.ReactivateIfStocked(ctx, db.ReactivateIfStockedParams{ID: productID, At: now})
			if errors.Is(err, pgx.ErrNoRows) {
				continue // was not SOLD_OUT
			}
			if err != nil {
				return err
			}
			old, next := string(db.ProductStatusSOLDOUT), string(db.ProductStatusACTIVE)
			if err := qtx.InsertProductEvent(ctx, db.InsertProductEventParams{
				ProductID: productID, Type: db.ProductEventTypeREACTIVATE, Actor: db.ActorTypeADMIN,
				Reason: "Stock came back from a return", OldValue: &old, NewValue: &next, At: now, ByAdminID: &adminID,
			}); err != nil {
				return err
			}
		}

		if before+in.RefundPaisa == pay.AmountPaisa && pay.Status != db.PaymentStatusREFUNDED {
			return qtx.SetPaymentRefunded(ctx, pay.ID)
		}
		return nil
	})
}

// taka: 41000 -> "410" (for messages only; the web formats real prices).
func taka(paisa int64) string {
	if paisa%100 == 0 {
		return fmt.Sprintf("%d", paisa/100)
	}
	return fmt.Sprintf("%d.%02d", paisa/100, paisa%100)
}

// Return is one recorded return, as the admin order page shows it.
type Return struct {
	ID             int64        `json:"id"`
	ReasonType     string       `json:"reasonType"`
	Note           string       `json:"note"`
	DeliveryPaidBy string       `json:"deliveryPaidBy"`
	RefundPaisa    int64        `json:"refundPaisa"`
	Currency       string       `json:"currency"`
	RefundMethod   *string      `json:"refundMethod"`
	RefundRef      string       `json:"refundRef"`
	Status         string       `json:"status"`
	At             time.Time    `json:"at"`
	AdminEmail     string       `json:"adminEmail"`
	Items          []ReturnLine `json:"items"`
}

type ReturnLine struct {
	OrderItemID  int64  `json:"orderItemId"`
	ProductName  string `json:"productName"`
	VariantLabel string `json:"variantLabel"`
	Qty          int32  `json:"qty"`
	Resellable   bool   `json:"resellable"`
}

// LoadReturns lists the returns of an order, oldest first.
func LoadReturns(ctx context.Context, q *db.Queries, orderID int64) ([]Return, error) {
	rows, err := q.ListReturnsForOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	items, err := q.ListReturnItemsForOrder(ctx, orderID)
	if err != nil {
		return nil, err
	}
	out := make([]Return, 0, len(rows))
	index := map[int64]int{}
	for _, r := range rows {
		ret := Return{
			ID: r.ID, ReasonType: string(r.ReasonType), Note: r.Note, DeliveryPaidBy: string(r.DeliveryPaidBy),
			RefundPaisa: r.RefundPaisa, Currency: r.Currency, RefundRef: r.RefundRef, Status: string(r.Status),
			At: r.CreatedAt, AdminEmail: r.AdminEmail, Items: []ReturnLine{},
		}
		if r.RefundMethod != nil {
			m := string(*r.RefundMethod)
			ret.RefundMethod = &m
		}
		index[r.ID] = len(out)
		out = append(out, ret)
	}
	for _, it := range items {
		if i, ok := index[it.ReturnID]; ok {
			out[i].Items = append(out[i].Items, ReturnLine{
				OrderItemID: it.OrderItemID, ProductName: it.ProductName, VariantLabel: it.VariantLabel,
				Qty: it.Qty, Resellable: it.Resellable,
			})
		}
	}
	return out, nil
}
