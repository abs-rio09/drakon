package orders

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// The admin's order work (docs/blueprint.md, part 8). Unlike View, these
// shapes contain personal data: only admin handlers may send them.

// nextMoves are the only status changes the admin may make. Anything else
// (DELIVERED -> PENDING, CANCELLED -> anything ...) is refused.
var nextMoves = map[db.OrderStatus][]db.OrderStatus{
	db.OrderStatusPENDING:   {db.OrderStatusCONFIRMED, db.OrderStatusCANCELLED},
	db.OrderStatusCONFIRMED: {db.OrderStatusSHIPPED, db.OrderStatusCANCELLED},
	db.OrderStatusSHIPPED:   {db.OrderStatusDELIVERED, db.OrderStatusCANCELLED},
}

// CanMove reports whether the admin may move an order from one status to another.
func CanMove(from, to db.OrderStatus) bool {
	for _, s := range nextMoves[from] {
		if s == to {
			return true
		}
	}
	return false
}

// MoveError: this status change is not allowed from the order's status.
type MoveError struct{ From, To db.OrderStatus }

func (e *MoveError) Error() string {
	return fmt.Sprintf("an order that is %s cannot become %s", e.From, e.To)
}

// Move is the admin's request: POST /api/admin/orders/{number}/status.
type Move struct {
	To           string `json:"to"`
	Reason       string `json:"reason"`       // needed to cancel
	CourierName  string `json:"courierName"`  // needed to ship
	TrackingCode string `json:"trackingCode"` // needed to ship
}

const (
	maxReasonRunes   = 200
	maxCourierRunes  = 60
	maxTrackingRunes = 100
	MaxNoteRunes     = 2000
)

func (m *Move) validate() (db.OrderStatus, error) {
	m.Reason = strings.TrimSpace(m.Reason)
	m.CourierName = strings.TrimSpace(m.CourierName)
	m.TrackingCode = strings.TrimSpace(m.TrackingCode)
	to := db.OrderStatus(strings.ToUpper(strings.TrimSpace(m.To)))
	fields := map[string]string{}
	switch to {
	case db.OrderStatusCONFIRMED, db.OrderStatusDELIVERED:
	case db.OrderStatusSHIPPED:
		if m.CourierName == "" {
			fields["courierName"] = "Enter the courier's name."
		} else if utf8.RuneCountInString(m.CourierName) > maxCourierRunes {
			fields["courierName"] = "Keep the courier name short."
		}
		if m.TrackingCode == "" {
			fields["trackingCode"] = "Enter the tracking code from the courier."
		} else if utf8.RuneCountInString(m.TrackingCode) > maxTrackingRunes {
			fields["trackingCode"] = "The tracking code is too long."
		}
	case db.OrderStatusCANCELLED:
		if m.Reason == "" {
			fields["reason"] = "Write why the order is cancelled."
		} else if utf8.RuneCountInString(m.Reason) > maxReasonRunes {
			fields["reason"] = "Keep the reason under 200 characters."
		}
	default:
		fields["to"] = "Choose CONFIRMED, SHIPPED, DELIVERED or CANCELLED."
	}
	if len(fields) > 0 {
		return to, &InputError{Code: "VALIDATION", Message: "Some details need fixing.", Fields: fields}
	}
	return to, nil
}

// AdminMove changes an order's status in ONE transaction, with a history
// row that keeps the admin's id. A cancel puts the stock back through
// CancelLocked (the same code as the buyer's cancel and the sweep).
func AdminMove(ctx context.Context, pool *pgxpool.Pool, number string, m Move, adminID int64, now time.Time) error {
	to, err := m.validate()
	if err != nil {
		return err
	}
	q := db.New(pool)
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		qtx := q.WithTx(tx)
		o, err := qtx.GetOrderByNumber(ctx, number)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		locked, err := qtx.GetOrderForUpdate(ctx, o.ID) // nobody else changes it until we commit
		if err != nil {
			return err
		}
		from := locked.Status
		if !CanMove(from, to) {
			return &MoveError{From: from, To: to}
		}

		history := func(note string) error {
			return qtx.InsertStatusHistory(ctx, db.InsertStatusHistoryParams{
				OrderID: o.ID, FromStatus: &from, ToStatus: to, Actor: db.ActorTypeADMIN,
				Note: note, At: now, ByAdminID: &adminID,
			})
		}
		switch to {
		case db.OrderStatusCONFIRMED:
			if err := qtx.SetOrderConfirmed(ctx, db.SetOrderConfirmedParams{ID: o.ID, At: &now}); err != nil {
				return err
			}
			return history("Confirmed by phone")
		case db.OrderStatusSHIPPED:
			if err := qtx.SetOrderShipped(ctx, db.SetOrderShippedParams{
				ID: o.ID, At: &now, CourierName: &m.CourierName, CourierTracking: &m.TrackingCode,
			}); err != nil {
				return err
			}
			return history(fmt.Sprintf("Shipped with %s, tracking code %s", m.CourierName, m.TrackingCode))
		case db.OrderStatusDELIVERED:
			if err := qtx.SetOrderDelivered(ctx, db.SetOrderDeliveredParams{ID: o.ID, At: &now}); err != nil {
				return err
			}
			if _, err := qtx.CollectCODPayment(ctx, db.CollectCODPaymentParams{OrderID: o.ID, At: &now}); err != nil {
				return err
			}
			return history("Delivered, cash collected")
		default: // CANCELLED
			onlyFrom := func(s db.OrderStatus) bool { return s == from }
			_, err := CancelLocked(ctx, qtx, o.ID, onlyFrom, db.ActorTypeADMIN, &adminID, "Cancelled by DRAKON: "+m.Reason, now)
			return err
		}
	})
}

// ---------- What the admin sees ----------

type AdminItem struct {
	VariantID      int64  `json:"variantId"`
	ProductID      int64  `json:"productId"`
	ProductSlug    string `json:"productSlug"`
	ProductName    string `json:"productName"`
	VariantLabel   string `json:"variantLabel"`
	SKU            string `json:"sku"`
	Thumb          string `json:"thumb"`
	Qty            int    `json:"qty"`
	UnitPricePaisa int64  `json:"unitPricePaisa"`
	LineTotalPaisa int64  `json:"lineTotalPaisa"`
}

type AdminStep struct {
	From       *string   `json:"from"`
	To         string    `json:"to"`
	At         time.Time `json:"at"`
	By         string    `json:"by"`         // CUSTOMER, ADMIN, SYSTEM
	AdminEmail *string   `json:"adminEmail"` // who, when By is ADMIN
	Note       string    `json:"note"`
}

type AdminPayment struct {
	Method      string     `json:"method"`
	AmountPaisa int64      `json:"amountPaisa"`
	Currency    string     `json:"currency"`
	Status      string     `json:"status"`
	CollectedAt *time.Time `json:"collectedAt"`
	Ref         *string    `json:"ref"`
}

type AdminOrder struct {
	ID           int64      `json:"-"`
	OrderNumber  string     `json:"orderNumber"`
	Status       string     `json:"status"`
	PlacedAt     time.Time  `json:"placedAt"`
	ConfirmedAt  *time.Time `json:"confirmedAt"`
	ShippedAt    *time.Time `json:"shippedAt"`
	DeliveredAt  *time.Time `json:"deliveredAt"`
	CancelledAt  *time.Time `json:"cancelledAt"`
	CancelReason *string    `json:"cancelReason"`
	CancelsAt    *time.Time `json:"cancelsAt"` // PENDING only: the auto-cancel time
	NextMoves    []string   `json:"nextMoves"`
	Customer     struct {
		Name  string  `json:"name"`
		Phone string  `json:"phone"`
		Email *string `json:"email"`
	} `json:"customer"`
	Delivery struct {
		District     string  `json:"district"`
		DistrictArea *string `json:"districtArea"`
		Area         string  `json:"area"`
		Address      string  `json:"address"`
		CourierNote  string  `json:"courierNote"`
		ZoneCode     string  `json:"zoneCode"`
	} `json:"delivery"`
	Gift struct {
		IsGift        bool    `json:"isGift"`
		ReceiverName  *string `json:"receiverName"`
		ReceiverPhone *string `json:"receiverPhone"`
		Note          string  `json:"note"`
		HidePrices    bool    `json:"hidePrices"`
	} `json:"gift"`
	Courier struct {
		Name     *string `json:"name"`
		Tracking *string `json:"tracking"`
	} `json:"courier"`
	Items         []AdminItem    `json:"items"`
	SubtotalPaisa int64          `json:"subtotalPaisa"`
	DeliveryPaisa int64          `json:"deliveryPaisa"`
	TotalPaisa    int64          `json:"totalPaisa"`
	Currency      string         `json:"currency"`
	PaymentMethod string         `json:"paymentMethod"`
	Payments      []AdminPayment `json:"payments"`
	Timeline      []AdminStep    `json:"timeline"`
	AdminNote     string         `json:"adminNote"`
	// The same phone's other orders: {"DELIVERED": 1, "CANCELLED": 2}.
	PhoneHistory map[string]int64 `json:"phoneHistory"`
	PhoneBlocked bool             `json:"phoneBlocked"`
}

// cancelsAt: when the sweep cancels a PENDING order.
func cancelsAt(status db.OrderStatus, placed time.Time, set settings.Settings) *time.Time {
	if status != db.OrderStatusPENDING {
		return nil
	}
	t := placed.Add(time.Duration(set.CodConfirmHours) * time.Hour)
	return &t
}

// LoadAdminOrder returns everything about one order, for the admin order page.
func LoadAdminOrder(ctx context.Context, q *db.Queries, number string, set settings.Settings) (*AdminOrder, error) {
	o, err := q.GetAdminOrder(ctx, number)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	a := &AdminOrder{
		ID: o.ID, OrderNumber: o.OrderNumber, Status: string(o.Status), PlacedAt: o.CreatedAt,
		ConfirmedAt: o.ConfirmedAt, ShippedAt: o.ShippedAt, DeliveredAt: o.DeliveredAt,
		CancelledAt: o.CancelledAt, CancelReason: o.CancelReason,
		CancelsAt: cancelsAt(o.Status, o.CreatedAt, set), NextMoves: []string{},
		SubtotalPaisa: o.SubtotalPaisa, DeliveryPaisa: o.DeliveryPaisa, TotalPaisa: o.TotalPaisa,
		Currency: o.Currency, PaymentMethod: string(o.PaymentMethod), AdminNote: o.AdminNote,
		Items: []AdminItem{}, Payments: []AdminPayment{}, Timeline: []AdminStep{}, PhoneHistory: map[string]int64{},
	}
	for _, s := range nextMoves[o.Status] {
		a.NextMoves = append(a.NextMoves, string(s))
	}
	a.Customer.Name, a.Customer.Phone, a.Customer.Email = o.Name, o.Phone, o.Email
	a.Delivery.District, a.Delivery.DistrictArea, a.Delivery.Area = o.District, o.DistrictArea, o.Area
	a.Delivery.Address, a.Delivery.CourierNote, a.Delivery.ZoneCode = o.Address, o.CourierNote, o.ZoneCode
	a.Gift.IsGift, a.Gift.ReceiverName, a.Gift.ReceiverPhone = o.IsGift, o.GiftReceiverName, o.GiftReceiverPhone
	a.Gift.Note, a.Gift.HidePrices = o.GiftNote, o.GiftHidePrices
	a.Courier.Name, a.Courier.Tracking = o.CourierName, o.CourierTracking

	items, err := q.ListAdminOrderItems(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	for _, it := range items {
		a.Items = append(a.Items, AdminItem{
			VariantID: it.VariantID, ProductID: it.ProductID, ProductSlug: it.ProductSlug,
			ProductName: it.ProductName, VariantLabel: it.VariantLabel, SKU: it.Sku, Thumb: it.Thumb,
			Qty: int(it.Qty), UnitPricePaisa: it.UnitPricePaisa, LineTotalPaisa: it.LineTotalPaisa,
		})
	}
	history, err := q.ListAdminStatusHistory(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	for _, h := range history {
		step := AdminStep{To: string(h.ToStatus), At: h.CreatedAt, By: string(h.Actor), AdminEmail: h.AdminEmail, Note: h.Note}
		if h.FromStatus != nil {
			f := string(*h.FromStatus)
			step.From = &f
		}
		a.Timeline = append(a.Timeline, step)
	}
	payments, err := q.ListPaymentsForOrder(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	for _, p := range payments {
		a.Payments = append(a.Payments, AdminPayment{
			Method: string(p.Method), AmountPaisa: p.AmountPaisa, Currency: p.Currency,
			Status: string(p.Status), CollectedAt: p.CollectedAt, Ref: p.Ref,
		})
	}
	counts, err := q.PhoneOrderCounts(ctx, db.PhoneOrderCountsParams{Phone: o.Phone, ExceptID: o.ID})
	if err != nil {
		return nil, err
	}
	for _, c := range counts {
		a.PhoneHistory[string(c.Status)] = c.N
	}
	if a.PhoneBlocked, err = q.IsPhoneBlocked(ctx, o.Phone); err != nil {
		return nil, err
	}
	return a, nil
}

// SetAdminNote saves the internal note (only admins see it).
func SetAdminNote(ctx context.Context, q *db.Queries, number, note string, now time.Time) error {
	note = strings.TrimSpace(note)
	if utf8.RuneCountInString(note) > MaxNoteRunes {
		return &InputError{Code: "VALIDATION", Message: "The note is too long.",
			Fields: map[string]string{"note": fmt.Sprintf("Keep the note under %d characters.", MaxNoteRunes)}}
	}
	n, err := q.SetOrderAdminNote(ctx, db.SetOrderAdminNoteParams{OrderNumber: number, Note: note, At: now})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ValidOrderNumber: the shape DRK-XXXXXX (anything else cannot exist).
func ValidOrderNumber(s string) bool { return orderNumberRe.MatchString(s) }
