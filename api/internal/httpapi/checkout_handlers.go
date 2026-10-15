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
	if errors.Is(err, orders.ErrNotFound) {
		return errorf(http.StatusNotFound, "ORDER_NOT_FOUND", "We could not find an order with this number and phone number. Check both and try again.")
	}
	if errors.Is(err, orders.ErrCannotCancel) {
		return errorf(http.StatusConflict, "CANNOT_CANCEL", "This order can no longer be cancelled online (it has shipped or is closed). Please contact us.")
	}
	var refused *orders.RefusedError
	if errors.As(err, &refused) {
		status := http.StatusConflict
		if refused.Code == "PHONE_BLOCKED" {
			status = http.StatusForbidden
		}
		e := &apiError{Status: status, Code: refused.Code, Message: refused.Message}
		if len(refused.Problems) > 0 {
			e.Problems = refused.Problems
		}
		return e
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

// POST /api/orders: places a Cash on Delivery order. Everything is checked
// again on the server; prices, delivery and totals come from the database.
// Answers 201 with the order number and a secret track token (shown once).
func (s *Server) handlePlaceOrder(w http.ResponseWriter, r *http.Request) error {
	var in orders.Checkout
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	placed, err := orders.Place(r.Context(), s.pool, in, s.now())
	if err != nil {
		return asAPIError(err)
	}
	writeJSON(w, http.StatusCreated, placed)
	return nil
}

// POST /api/orders/track: order number + phone (or the saved token) ->
// status timeline and items. A wrong number and a wrong phone get the same
// "not found" answer.
func (s *Server) handleTrackOrder(w http.ResponseWriter, r *http.Request) error {
	var in orders.Lookup
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	view, err := orders.Track(r.Context(), s.pool, in)
	if err != nil {
		return asAPIError(err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"order": view})
	return nil
}

type cancelRequest struct {
	orders.Lookup
	Reason string `json:"reason"`
}

// POST /api/orders/cancel: the buyer cancels while the order is PENDING or
// CONFIRMED. The stock goes back.
func (s *Server) handleCancelOrder(w http.ResponseWriter, r *http.Request) error {
	var in cancelRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	view, err := orders.Cancel(r.Context(), s.pool, in.Lookup, in.Reason, s.now())
	if err != nil {
		return asAPIError(err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"order": view})
	return nil
}
