package httpapi

import (
	"errors"
	"net/http"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/orders"
)

// loadReturns lists the returns recorded for an order.
func (s *Server) loadReturns(r *http.Request, orderID int64) ([]orders.Return, error) {
	return orders.LoadReturns(r.Context(), s.q, orderID)
}

// POST /api/admin/orders/{number}/returns: record a return of a DELIVERED
// order (blueprint rule 3). Answers with the whole order again.
func (s *Server) handleAdminReturn(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	number, err := orderNumberParam(r)
	if err != nil {
		return err
	}
	var in orders.ReturnInput
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	err = orders.RecordReturn(r.Context(), s.pool, number, in, admin.ID, s.now())
	var refused *orders.ReturnError
	switch {
	case errors.As(err, &refused):
		return errorf(http.StatusConflict, refused.Code, "%s", refused.Message)
	case errors.Is(err, orders.ErrNotFound):
		return adminOrderNotFound()
	case err != nil:
		return asAPIError(err)
	}
	return s.writeAdminOrder(w, r, number)
}
