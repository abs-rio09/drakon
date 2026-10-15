package httpapi

import (
	"errors"
	"net/http"

	"github.com/abs-rio09/drakon/api/internal/orders"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// asAPIError turns an orders.InputError into the shared error shape.
// Anything else is returned unchanged (and becomes a 500).
func asAPIError(err error) error {
	var in *orders.InputError
	if errors.As(err, &in) {
		status := http.StatusBadRequest
		if len(in.Fields) > 0 {
			status = http.StatusUnprocessableEntity
		}
		return &apiError{Status: status, Code: in.Code, Message: in.Message, Fields: in.Fields}
	}
	return err
}

type quoteRequest struct {
	Items          []orders.Line `json:"items"`
	DeliveryAreaID *int64        `json:"deliveryAreaId"`
}

// POST /api/checkout/quote: prices the cart from the database and lists
// any problems (sold out, not enough stock, over the purchase limit).
// The browser sends only variant ids and quantities, never prices.
func (s *Server) handleQuote(w http.ResponseWriter, r *http.Request) error {
	var req quoteRequest
	if err := decodeJSON(w, r, &req); err != nil {
		return err
	}
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	quote, err := orders.BuildQuote(r.Context(), s.q, set, req.Items, req.DeliveryAreaID)
	if err != nil {
		return asAPIError(err)
	}
	writeJSON(w, http.StatusOK, quote)
	return nil
}
