package httpapi

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/jobs"
	"github.com/abs-rio09/drakon/api/internal/orders"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// dhaka is Bangladesh time (UTC+6, no summer time). "Today" on the
// dashboard starts at midnight here, wherever the server runs.
var dhaka = time.FixedZone("Asia/Dhaka", 6*3600)

func startOfDay(t time.Time) time.Time {
	t = t.In(dhaka)
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, dhaka)
}

// runSweep auto-cancels expired orders before the admin looks at them
// (blueprint part 4: "before the admin order list opens"), so the admin
// never sees, or confirms, an order that should already be cancelled.
func (s *Server) runSweep(r *http.Request) error {
	sw := jobs.NewSweeper(s.pool, s.log)
	sw.Now = s.now // the same clock as the request (tests move it)
	_, err := sw.RunOnce(r.Context())
	return err
}

type moneyCount struct {
	Orders     int64 `json:"orders"`
	TotalPaisa int64 `json:"totalPaisa"`
}

// GET /api/admin/dashboard: orders by status, today's orders, and the money
// collected (DELIVERED) today and in the last 7 days.
func (s *Server) handleAdminDashboard(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	if err := s.runSweep(r); err != nil {
		return err
	}
	ctx := r.Context()
	counts := map[string]int64{}
	for _, st := range []db.OrderStatus{db.OrderStatusPENDING, db.OrderStatusCONFIRMED, db.OrderStatusSHIPPED, db.OrderStatusDELIVERED, db.OrderStatusCANCELLED} {
		counts[string(st)] = 0
	}
	rows, err := s.q.CountOrdersByStatus(ctx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		counts[string(row.Status)] = row.N
	}
	today := startOfDay(s.now())
	weekAgo := today.AddDate(0, 0, -6) // today + the 6 days before = 7 days
	placed, err := s.q.OrdersPlacedSince(ctx, today)
	if err != nil {
		return err
	}
	salesToday, err := s.q.DeliveredSalesSince(ctx, &today)
	if err != nil {
		return err
	}
	salesWeek, err := s.q.DeliveredSalesSince(ctx, &weekAgo)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"counts":             counts,
		"placedToday":        moneyCount{Orders: placed.N, TotalPaisa: placed.TotalPaisa},
		"deliveredToday":     moneyCount{Orders: salesToday.N, TotalPaisa: salesToday.TotalPaisa},
		"deliveredLast7Days": moneyCount{Orders: salesWeek.N, TotalPaisa: salesWeek.TotalPaisa},
		"currency":           "BDT",
	})
	return nil
}

type adminOrderRow struct {
	OrderNumber  string     `json:"orderNumber"`
	Status       string     `json:"status"`
	Name         string     `json:"name"`
	Phone        string     `json:"phone"`
	District     string     `json:"district"`
	DistrictArea *string    `json:"districtArea"`
	ZoneCode     string     `json:"zoneCode"`
	ItemCount    int32      `json:"itemCount"`
	TotalPaisa   int64      `json:"totalPaisa"`
	Currency     string     `json:"currency"`
	PlacedAt     time.Time  `json:"placedAt"`
	ConfirmedAt  *time.Time `json:"confirmedAt,omitempty"`
	ShippedAt    *time.Time `json:"shippedAt,omitempty"`
	DeliveredAt  *time.Time `json:"deliveredAt,omitempty"`
	CancelledAt  *time.Time `json:"cancelledAt,omitempty"`
	CancelReason *string    `json:"cancelReason,omitempty"`
	CourierName  *string    `json:"courierName,omitempty"`
	CancelsAt    *time.Time `json:"cancelsAt,omitempty"` // PENDING only
}

var orderStatuses = map[string]db.OrderStatus{
	"PENDING": db.OrderStatusPENDING, "CONFIRMED": db.OrderStatusCONFIRMED, "SHIPPED": db.OrderStatusSHIPPED,
	"DELIVERED": db.OrderStatusDELIVERED, "CANCELLED": db.OrderStatusCANCELLED,
}

// GET /api/admin/orders?status=&q=&limit=&offset=
// q matches the order number, the buyer's name or the phone.
func (s *Server) handleAdminOrders(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	query := r.URL.Query()
	limit, err := intParam(query.Get("limit"), 50, 1, maxPageSize, "limit")
	if err != nil {
		return err
	}
	offset, err := intParam(query.Get("offset"), 0, 0, maxOffset, "offset")
	if err != nil {
		return err
	}
	var status *db.OrderStatus
	if raw := strings.ToUpper(strings.TrimSpace(query.Get("status"))); raw != "" {
		st, ok := orderStatuses[raw]
		if !ok {
			return badRequest("BAD_QUERY", "status must be PENDING, CONFIRMED, SHIPPED, DELIVERED or CANCELLED.")
		}
		status = &st
	}
	var pattern, phonePattern *string
	if text := strings.TrimSpace(query.Get("q")); text != "" {
		if utf8.RuneCountInString(text) > maxSearchRunes {
			return badRequest("BAD_QUERY", "The search text is too long (at most 100 characters).")
		}
		p := "%" + escapeLike(text) + "%"
		pp := "%" + escapeLike(orders.NormalizePhone(text)) + "%"
		pattern, phonePattern = &p, &pp
	}
	if err := s.runSweep(r); err != nil {
		return err
	}
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	rows, err := s.q.ListAdminOrders(r.Context(), db.ListAdminOrdersParams{
		Status: status, Pattern: pattern, PhonePattern: phonePattern, Limit: int32(limit), Offset: int32(offset),
	})
	if err != nil {
		return err
	}
	total, err := s.q.CountAdminOrders(r.Context(), db.CountAdminOrdersParams{Status: status, Pattern: pattern, PhonePattern: phonePattern})
	if err != nil {
		return err
	}
	out := make([]adminOrderRow, 0, len(rows))
	for _, o := range rows {
		row := adminOrderRow{
			OrderNumber: o.OrderNumber, Status: string(o.Status), Name: o.Name, Phone: o.Phone,
			District: o.District, DistrictArea: o.DistrictArea, ZoneCode: o.ZoneCode, ItemCount: o.ItemCount,
			TotalPaisa: o.TotalPaisa, Currency: o.Currency, PlacedAt: o.CreatedAt, ConfirmedAt: o.ConfirmedAt,
			ShippedAt: o.ShippedAt, DeliveredAt: o.DeliveredAt, CancelledAt: o.CancelledAt,
			CancelReason: o.CancelReason, CourierName: o.CourierName,
		}
		if o.Status == db.OrderStatusPENDING {
			t := o.CreatedAt.Add(time.Duration(set.CodConfirmHours) * time.Hour)
			row.CancelsAt = &t
		}
		out = append(out, row)
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": out, "total": total, "limit": limit, "offset": offset})
	return nil
}

type callListRow struct {
	OrderNumber  string    `json:"orderNumber"`
	Name         string    `json:"name"`
	Phone        string    `json:"phone"`
	District     string    `json:"district"`
	DistrictArea *string   `json:"districtArea"`
	ZoneCode     string    `json:"zoneCode"`
	ItemCount    int32     `json:"itemCount"`
	TotalPaisa   int64     `json:"totalPaisa"`
	Currency     string    `json:"currency"`
	PlacedAt     time.Time `json:"placedAt"`
	CancelsAt    time.Time `json:"cancelsAt"`
	MinutesLeft  int64     `json:"minutesLeft"`
}

// GET /api/admin/orders/call-list: PENDING orders, the oldest first, with
// the time left before the automatic cancel (cod_confirm_hours).
func (s *Server) handleAdminCallList(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	if err := s.runSweep(r); err != nil {
		return err
	}
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	rows, err := s.q.ListCallList(r.Context())
	if err != nil {
		return err
	}
	now := s.now()
	out := make([]callListRow, 0, len(rows))
	for _, o := range rows {
		cancels := o.CreatedAt.Add(time.Duration(set.CodConfirmHours) * time.Hour)
		left := int64(cancels.Sub(now) / time.Minute)
		if left < 0 {
			left = 0
		}
		out = append(out, callListRow{
			OrderNumber: o.OrderNumber, Name: o.Name, Phone: o.Phone, District: o.District,
			DistrictArea: o.DistrictArea, ZoneCode: o.ZoneCode, ItemCount: o.ItemCount,
			TotalPaisa: o.TotalPaisa, Currency: o.Currency, PlacedAt: o.CreatedAt,
			CancelsAt: cancels, MinutesLeft: left,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": out, "codConfirmHours": set.CodConfirmHours})
	return nil
}

// orderNumberParam reads {number} from the path. A wrong shape is a 404.
func orderNumberParam(r *http.Request) (string, error) {
	n := strings.ToUpper(strings.TrimSpace(r.PathValue("number")))
	if !orders.ValidOrderNumber(n) {
		return "", adminOrderNotFound()
	}
	return n, nil
}

func adminOrderNotFound() *apiError {
	return errorf(http.StatusNotFound, "ORDER_NOT_FOUND", "There is no order with this number.")
}

// writeAdminOrder sends the full order (after loading it again).
func (s *Server) writeAdminOrder(w http.ResponseWriter, r *http.Request, number string) error {
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	o, err := orders.LoadAdminOrder(r.Context(), s.q, number, set)
	if errors.Is(err, orders.ErrNotFound) {
		return adminOrderNotFound()
	}
	if err != nil {
		return err
	}
	ret, err := s.loadReturns(r, o.ID)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"order": o, "returns": ret})
	return nil
}

// GET /api/admin/orders/{number}: everything about one order.
func (s *Server) handleAdminOrder(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	number, err := orderNumberParam(r)
	if err != nil {
		return err
	}
	if err := s.runSweep(r); err != nil {
		return err
	}
	return s.writeAdminOrder(w, r, number)
}

// POST /api/admin/orders/{number}/status {to, reason, courierName, trackingCode}
func (s *Server) handleAdminOrderStatus(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	number, err := orderNumberParam(r)
	if err != nil {
		return err
	}
	var in orders.Move
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := s.runSweep(r); err != nil {
		return err
	}
	err = orders.AdminMove(r.Context(), s.pool, number, in, admin.ID, s.now())
	var moveErr *orders.MoveError
	switch {
	case errors.As(err, &moveErr):
		return errorf(http.StatusConflict, "BAD_TRANSITION", "This order is %s, so it cannot be marked %s.",
			strings.ToLower(string(moveErr.From)), strings.ToLower(string(moveErr.To)))
	case errors.Is(err, orders.ErrNotFound):
		return adminOrderNotFound()
	case err != nil:
		return asAPIError(err)
	}
	return s.writeAdminOrder(w, r, number)
}

type noteRequest struct {
	Note string `json:"note"`
}

// PUT /api/admin/orders/{number}/note {note}: the internal note.
func (s *Server) handleAdminOrderNote(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	number, err := orderNumberParam(r)
	if err != nil {
		return err
	}
	var in noteRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	err = orders.SetAdminNote(r.Context(), s.q, number, in.Note, s.now())
	if errors.Is(err, orders.ErrNotFound) {
		return adminOrderNotFound()
	}
	if err != nil {
		return asAPIError(err)
	}
	return s.writeAdminOrder(w, r, number)
}

// ---------- Blocked phones ----------

type blockRequest struct {
	Phone  string `json:"phone"`
	Reason string `json:"reason"`
}

func cleanPhone(raw string) (string, error) {
	phone := orders.NormalizePhone(raw)
	if !orders.IsBDMobile(phone) {
		return "", &apiError{Status: http.StatusUnprocessableEntity, Code: "VALIDATION", Message: "Check the phone number.",
			Fields: map[string]string{"phone": "Enter an 11-digit mobile number, like 01712345678."}}
	}
	return phone, nil
}

// GET /api/admin/blocked-phones
func (s *Server) handleBlockedPhones(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	rows, err := s.q.ListBlockedPhones(r.Context())
	if err != nil {
		return err
	}
	type row struct {
		Phone     string    `json:"phone"`
		Reason    string    `json:"reason"`
		BlockedAt time.Time `json:"blockedAt"`
		BlockedBy *string   `json:"blockedBy"`
	}
	out := make([]row, 0, len(rows))
	for _, b := range rows {
		out = append(out, row{Phone: b.Phone, Reason: b.Reason, BlockedAt: b.CreatedAt, BlockedBy: b.BlockedBy})
	}
	writeJSON(w, http.StatusOK, map[string]any{"phones": out})
	return nil
}

// POST /api/admin/blocked-phones {phone, reason}: this phone can no longer
// place orders on the website.
func (s *Server) handleBlockPhone(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	var in blockRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	phone, err := cleanPhone(in.Phone)
	if err != nil {
		return err
	}
	reason := strings.TrimSpace(in.Reason)
	switch {
	case reason == "":
		return &apiError{Status: http.StatusUnprocessableEntity, Code: "VALIDATION", Message: "Write a reason.",
			Fields: map[string]string{"reason": "Write why this phone is blocked."}}
	case utf8.RuneCountInString(reason) > 200:
		return &apiError{Status: http.StatusUnprocessableEntity, Code: "VALIDATION", Message: "Keep the reason short.",
			Fields: map[string]string{"reason": "Keep the reason under 200 characters."}}
	}
	if err := s.q.BlockPhone(r.Context(), db.BlockPhoneParams{Phone: phone, Reason: reason, At: s.now(), ByAdminID: &admin.ID}); err != nil {
		return err
	}
	return s.handleBlockedPhones(w, r, admin)
}

// POST /api/admin/blocked-phones/unblock {phone}. A POST with a body, not
// DELETE /blocked-phones/{phone}: a phone number in the URL would land in
// the server log, and phones are personal data.
func (s *Server) handleUnblockPhone(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	var in struct {
		Phone string `json:"phone"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	phone, err := cleanPhone(in.Phone)
	if err != nil {
		return err
	}
	n, err := s.q.UnblockPhone(r.Context(), phone)
	if err != nil {
		return err
	}
	if n == 0 {
		return notFound("This phone number is not blocked.")
	}
	return s.handleBlockedPhones(w, r, admin)
}
