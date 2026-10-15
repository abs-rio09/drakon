package orders

import (
	"context"
	"time"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// View is what the confirmation and track pages show. On purpose it has no
// name, phone, email or address: anyone who knows an order number and a
// phone could read it, so it shows only the order itself.
type View struct {
	OrderNumber     string     `json:"orderNumber"`
	Status          string     `json:"status"`
	PlacedAt        time.Time  `json:"placedAt"`
	Items           []ViewItem `json:"items"`
	SubtotalPaisa   int64      `json:"subtotalPaisa"`
	DeliveryPaisa   int64      `json:"deliveryPaisa"`
	TotalPaisa      int64      `json:"totalPaisa"`
	Currency        string     `json:"currency"`
	PaymentMethod   string     `json:"paymentMethod"`
	ZoneCode        string     `json:"zoneCode"`
	IsGift          bool       `json:"isGift"`
	Timeline        []Step     `json:"timeline"`
	CanCancel       bool       `json:"canCancel"`
	CancelReason    *string    `json:"cancelReason"`
	CodConfirmHours int        `json:"codConfirmHours"`
	// For a PENDING order: when it is cancelled if we could not confirm it.
	ConfirmBy *time.Time `json:"confirmBy"`
}

type ViewItem struct {
	ProductName    string `json:"productName"`
	VariantName    string `json:"variantName"`
	Qty            int    `json:"qty"`
	UnitPricePaisa int64  `json:"unitPricePaisa"`
	LineTotalPaisa int64  `json:"lineTotalPaisa"`
}

type Step struct {
	Status string    `json:"status"`
	At     time.Time `json:"at"`
	By     string    `json:"by"` // CUSTOMER, ADMIN, SYSTEM
	Note   string    `json:"note"`
}

// cancellable: the buyer may cancel only before the order ships.
func cancellable(status db.OrderStatus) bool {
	return status == db.OrderStatusPENDING || status == db.OrderStatusCONFIRMED
}

func loadView(ctx context.Context, q *db.Queries, number string, set settings.Settings) (*View, error) {
	o, err := q.GetOrderByNumber(ctx, number)
	if err != nil {
		return nil, err
	}
	return buildView(ctx, q, o, set)
}

func buildView(ctx context.Context, q *db.Queries, o db.GetOrderByNumberRow, set settings.Settings) (*View, error) {
	itemRows, err := q.ListOrderItems(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	historyRows, err := q.ListStatusHistory(ctx, o.ID)
	if err != nil {
		return nil, err
	}
	v := &View{
		OrderNumber: o.OrderNumber, Status: string(o.Status), PlacedAt: o.CreatedAt,
		Items: []ViewItem{}, Timeline: []Step{},
		SubtotalPaisa: o.SubtotalPaisa, DeliveryPaisa: o.DeliveryPaisa, TotalPaisa: o.TotalPaisa,
		Currency: o.Currency, PaymentMethod: string(o.PaymentMethod), ZoneCode: o.ZoneCode,
		IsGift: o.IsGift, CanCancel: cancellable(o.Status), CancelReason: o.CancelReason,
		CodConfirmHours: set.CodConfirmHours,
	}
	for _, it := range itemRows {
		v.Items = append(v.Items, ViewItem{
			ProductName: it.ProductName, VariantName: it.VariantLabel, Qty: int(it.Qty),
			UnitPricePaisa: it.UnitPricePaisa, LineTotalPaisa: it.LineTotalPaisa,
		})
	}
	for _, h := range historyRows {
		v.Timeline = append(v.Timeline, Step{Status: string(h.ToStatus), At: h.CreatedAt, By: string(h.Actor), Note: h.Note})
	}
	if o.Status == db.OrderStatusPENDING {
		by := o.CreatedAt.Add(time.Duration(set.CodConfirmHours) * time.Hour)
		v.ConfirmBy = &by
	}
	return v, nil
}
