package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/abs-rio09/drakon/api/internal/catalog"
	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// Pagination bounds for GET /api/products.
const (
	defaultPageSize = 24
	maxPageSize     = 100
	maxOffset       = 10_000
	maxSearchRunes  = 100
	relatedCount    = 4
)

func (s *Server) handleCategories(w http.ResponseWriter, r *http.Request) error {
	cats, err := catalog.ListCategories(r.Context(), s.q)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"categories": cats})
	return nil
}

// GET /api/products?category=&q=&limit=&offset=
// Products on sale (ACTIVE) only. Sold out runs are in /api/sold-out.
func (s *Server) handleProducts(w http.ResponseWriter, r *http.Request) error {
	query := r.URL.Query()
	limit, err := intParam(query.Get("limit"), defaultPageSize, 1, maxPageSize, "limit")
	if err != nil {
		return err
	}
	offset, err := intParam(query.Get("offset"), 0, 0, maxOffset, "offset")
	if err != nil {
		return err
	}

	var category, pattern *string
	if c := strings.TrimSpace(query.Get("category")); c != "" {
		category = &c
	}
	if q := strings.TrimSpace(query.Get("q")); q != "" {
		if utf8.RuneCountInString(q) > maxSearchRunes {
			return badRequest("BAD_QUERY", "The search text is too long (at most 100 characters).")
		}
		p := "%" + escapeLike(q) + "%"
		pattern = &p
	}

	rows, err := s.q.ListShopProducts(r.Context(), db.ListShopProductsParams{
		Category: category, Pattern: pattern, Limit: int32(limit), Offset: int32(offset),
	})
	if err != nil {
		return err
	}
	total, err := s.q.CountShopProducts(r.Context(), db.CountShopProductsParams{Category: category, Pattern: pattern})
	if err != nil {
		return err
	}
	products, err := catalog.LoadProducts(r.Context(), s.q, rows)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"products": products, "total": total, "limit": limit, "offset": offset,
	})
	return nil
}

// GET /api/products/featured: "The current drop" on the home page, plus the
// product under the hero's gallery label (setting home_hero_product_slug).
func (s *Server) handleFeatured(w http.ResponseWriter, r *http.Request) error {
	featuredIDs, err := s.q.ListFeaturedProductIDs(r.Context())
	if err != nil {
		return err
	}
	products, err := catalog.LoadProducts(r.Context(), s.q, featuredIDs)
	if err != nil {
		return err
	}
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	var hero *catalog.Product
	if set.HomeHeroProductSlug != "" {
		if p, err := s.productBySlug(r, set.HomeHeroProductSlug); err == nil {
			hero = p
		} else if !isNotFound(err) {
			return err
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"products": products, "hero": hero})
	return nil
}

// GET /api/products/{slug}: everything the product page shows, plus a few
// related products. DRAFT products answer 404 like unknown ones.
func (s *Server) handleProduct(w http.ResponseWriter, r *http.Request) error {
	product, err := s.productBySlug(r, r.PathValue("slug"))
	if err != nil {
		return err
	}
	shopRows, err := s.q.ListShopProducts(r.Context(), db.ListShopProductsParams{Limit: maxPageSize})
	if err != nil {
		return err
	}
	shop, err := catalog.LoadProducts(r.Context(), s.q, shopRows)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"product": product,
		"related": catalog.Related(*product, shop, relatedCount),
	})
	return nil
}

// GET /api/sold-out: SOLD_OUT and ARCHIVED runs, the most recent first.
func (s *Server) handleSoldOut(w http.ResponseWriter, r *http.Request) error {
	archiveIDs, err := s.q.ListArchiveProductIDs(r.Context())
	if err != nil {
		return err
	}
	products, err := catalog.LoadProducts(r.Context(), s.q, archiveIDs)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"products": products})
	return nil
}

func (s *Server) productBySlug(r *http.Request, slug string) (*catalog.Product, error) {
	id, err := s.q.GetProductIDBySlug(r.Context(), slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, notFound("There is no product with this address.")
	}
	if err != nil {
		return nil, err
	}
	products, err := catalog.LoadProducts(r.Context(), s.q, []int64{id})
	if err != nil {
		return nil, err
	}
	if len(products) == 0 {
		return nil, notFound("There is no product with this address.")
	}
	return &products[0], nil
}

func isNotFound(err error) bool {
	var apiErr *apiError
	return errors.As(err, &apiErr) && apiErr.Status == http.StatusNotFound
}

// intParam reads an optional whole-number query parameter within [min, max].
func intParam(raw string, def, min, max int, name string) (int, error) {
	if raw == "" {
		return def, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < min || n > max {
		return 0, errorf(http.StatusBadRequest, "BAD_QUERY", "%s must be a whole number from %d to %d.", name, min, max)
	}
	return n, nil
}

// escapeLike makes the user's text match literally inside ILIKE: % and _
// are wildcards in SQL patterns, so "50%" must not mean "50 and anything".
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
