package httpapi

import (
	"net/http"

	"github.com/abs-rio09/drakon/api/internal/auth"
)

type adminCategory struct {
	ID           int64  `json:"id"`
	Slug         string `json:"slug"`
	Name         string `json:"name"`
	Image        string `json:"image"`
	SortOrder    int32  `json:"sortOrder"`
	IsActive     bool   `json:"isActive"`
	ProductCount int32  `json:"productCount"`
}

// GET /api/admin/categories: all categories, also the ones turned off.
func (s *Server) handleAdminCategories(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	rows, err := s.q.ListAdminCategories(r.Context())
	if err != nil {
		return err
	}
	out := make([]adminCategory, 0, len(rows))
	for _, c := range rows {
		out = append(out, adminCategory{
			ID: c.ID, Slug: c.Slug, Name: c.Name, Image: c.ImageUrl, SortOrder: c.SortOrder,
			IsActive: c.IsActive, ProductCount: c.ProductCount,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"categories": out})
	return nil
}
