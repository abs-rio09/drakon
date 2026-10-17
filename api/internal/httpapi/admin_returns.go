package httpapi

import "net/http"

// loadReturns lists the returns recorded for an order (Phase 6 fills this).
func (s *Server) loadReturns(r *http.Request, orderID int64) ([]any, error) {
	return []any{}, nil
}
