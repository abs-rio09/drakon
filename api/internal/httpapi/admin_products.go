package httpapi

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/products"
)

// The admin's product work. The rules live in internal/products; these
// handlers only read the request and write the answer.
// There is no DELETE for products or variants anywhere, on purpose.

var productStatuses = map[string]db.ProductStatus{
	"DRAFT": db.ProductStatusDRAFT, "ACTIVE": db.ProductStatusACTIVE,
	"SOLD_OUT": db.ProductStatusSOLDOUT, "ARCHIVED": db.ProductStatusARCHIVED,
}

// idParam reads a positive whole number {name} from the path.
func idParam(r *http.Request, name string) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		return 0, notFound("There is nothing with this id.")
	}
	return id, nil
}

// writeProduct sends the product as the edit page shows it.
func (s *Server) writeProduct(w http.ResponseWriter, r *http.Request, status int, id int64) error {
	p, err := products.Load(r.Context(), s.q, id)
	if err != nil {
		return asAPIError(err)
	}
	writeJSON(w, status, map[string]any{"product": p})
	return nil
}

// GET /api/admin/products?status=&category=&q=
func (s *Server) handleAdminProducts(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	query := r.URL.Query()
	var status *db.ProductStatus
	if raw := strings.ToUpper(strings.TrimSpace(query.Get("status"))); raw != "" {
		st, ok := productStatuses[raw]
		if !ok {
			return badRequest("BAD_QUERY", "status must be DRAFT, ACTIVE, SOLD_OUT or ARCHIVED.")
		}
		status = &st
	}
	var category, pattern *string
	if c := strings.TrimSpace(query.Get("category")); c != "" {
		category = &c
	}
	if text := strings.TrimSpace(query.Get("q")); text != "" {
		if utf8.RuneCountInString(text) > maxSearchRunes {
			return badRequest("BAD_QUERY", "The search text is too long (at most 100 characters).")
		}
		p := "%" + escapeLike(text) + "%"
		pattern = &p
	}
	if err := s.runSweep(r); err != nil { // SOLD_OUT runs older than archive_after_days move first
		return err
	}
	rows, err := products.List(r.Context(), s.q, status, category, pattern)
	if err != nil {
		return err
	}
	counts := map[string]int64{"DRAFT": 0, "ACTIVE": 0, "SOLD_OUT": 0, "ARCHIVED": 0}
	countRows, err := s.q.CountProductsByStatus(r.Context())
	if err != nil {
		return err
	}
	for _, c := range countRows {
		counts[string(c.Status)] = c.N
	}
	writeJSON(w, http.StatusOK, map[string]any{"products": rows, "counts": counts})
	return nil
}

// POST /api/admin/products: a new product, always DRAFT.
func (s *Server) handleAdminCreateProduct(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	var in products.Input
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	id, err := products.Create(r.Context(), s.pool, in, s.now())
	if err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusCreated, id)
}

// GET /api/admin/products/{id}
func (s *Server) handleAdminProduct(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	return s.writeProduct(w, r, http.StatusOK, id)
}

// PUT /api/admin/products/{id}: the whole product form.
func (s *Server) handleAdminUpdateProduct(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in products.Input
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := products.Update(r.Context(), s.pool, id, in, s.now()); err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, id)
}

type publishRequest struct {
	// The prices the admin saw on the "check the prices" screen.
	Prices []products.ConfirmedPrice `json:"prices"`
}

// POST /api/admin/products/{id}/publish {prices}: DRAFT -> ACTIVE.
func (s *Server) handleAdminPublish(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in publishRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := products.Publish(r.Context(), s.pool, id, in.Prices, admin.ID, s.now()); err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, id)
}

type reasonRequest struct {
	Reason string `json:"reason"`
}

// POST /api/admin/products/{id}/archive {reason}: SOLD_OUT -> ARCHIVED.
func (s *Server) handleAdminArchive(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in reasonRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := products.Archive(r.Context(), s.pool, id, in.Reason, admin.ID, s.now()); err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, id)
}

// POST /api/admin/products/{id}/reactivate {reason}: ARCHIVED -> ACTIVE (Owner, recorded).
func (s *Server) handleAdminReactivate(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in reasonRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := products.Reactivate(r.Context(), s.pool, id, in.Reason, admin.ID, s.now()); err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, id)
}

// POST /api/admin/products/{id}/variants: a new variant (stock starts at 0).
func (s *Server) handleAdminAddVariant(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in products.VariantInput
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if _, err := products.AddVariant(r.Context(), s.pool, id, in, s.now()); err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusCreated, id)
}

// PUT /api/admin/variants/{id}: label, note, photo, order, on/off (and the
// price while the product is a draft).
func (s *Server) handleAdminUpdateVariant(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in products.VariantInput
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	productID, err := products.UpdateVariant(r.Context(), s.pool, id, in, s.now())
	if err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, productID)
}

// POST /api/admin/variants/{id}/stock {change, reason, note}
func (s *Server) handleAdminStock(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in products.StockInput
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	productID, err := products.ChangeStock(r.Context(), s.pool, id, in, admin.ID, s.now())
	if err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, productID)
}

// POST /api/admin/variants/{id}/price-fix {pricePaisa, reason}
func (s *Server) handleAdminPriceFix(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in products.PriceFixInput
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	productID, err := products.PriceFix(r.Context(), s.pool, id, in, admin.ID, s.now())
	if err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, productID)
}

// POST /api/admin/products/{id}/images {url, thumbUrl, shortName, alt}
func (s *Server) handleAdminAddImage(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in products.ImageInput
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := products.AddImage(r.Context(), s.pool, s.images, id, in, s.now()); err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusCreated, id)
}

// PUT /api/admin/products/{id}/images/order {ids}: the first is the cover.
func (s *Server) handleAdminImageOrder(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in struct {
		IDs []int64 `json:"ids"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := products.ReorderImages(r.Context(), s.pool, id, in.IDs, s.now()); err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, id)
}

// PUT /api/admin/images/{id} {url, thumbUrl, shortName, alt}
func (s *Server) handleAdminUpdateImage(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in products.ImageInput
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	productID, err := products.UpdateImage(r.Context(), s.pool, s.images, id, in, s.now())
	if err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, productID)
}

// DELETE /api/admin/images/{id}: takes the photo off (the product stays).
func (s *Server) handleAdminRemoveImage(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	productID, err := products.RemoveImage(r.Context(), s.pool, id, s.now())
	if err != nil {
		return asAPIError(err)
	}
	return s.writeProduct(w, r, http.StatusOK, productID)
}
