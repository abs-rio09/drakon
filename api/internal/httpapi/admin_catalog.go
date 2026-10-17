package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/products"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// Categories, settings and delivery (docs/blueprint.md, part 8 "Settings
// work"). Nothing here is ever deleted: categories, zones and areas are
// turned off instead. The shop reads these tables on every request, so a
// change shows on the website at once (no rebuild).

func formError(fields map[string]string) *apiError {
	return &apiError{Status: http.StatusUnprocessableEntity, Code: "VALIDATION", Message: "Some details need fixing.", Fields: fields}
}

func isUnique(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && (constraint == "" || pgErr.ConstraintName == constraint)
}

// ---------- Categories ----------

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

type categoryRequest struct {
	Slug     string `json:"slug"` // only when creating; empty = made from the name
	Name     string `json:"name"`
	Image    string `json:"image"`
	IsActive *bool  `json:"isActive"`
}

var categorySlugRe = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

func (s *Server) checkCategory(in *categoryRequest, creating bool) map[string]string {
	f := map[string]string{}
	in.Name = strings.TrimSpace(in.Name)
	switch n := utf8.RuneCountInString(in.Name); {
	case n < 2:
		f["name"] = "Enter the category name (plural, for the menu: Playcards)."
	case n > 60:
		f["name"] = "Keep the name short."
	}
	if creating {
		in.Slug = strings.ToLower(strings.TrimSpace(in.Slug))
		if in.Slug == "" {
			in.Slug = products.Slugify(in.Name)
		}
		if !categorySlugRe.MatchString(in.Slug) || len(in.Slug) > 60 {
			f["slug"] = "Use small letters, numbers and dashes, like sports-toys."
		}
	}
	if strings.TrimSpace(in.Image) != "" {
		img, err := s.images.Check(in.Image)
		if err != nil {
			f["image"] = err.Error()
		}
		in.Image = img
	} else {
		in.Image = ""
	}
	return f
}

// POST /api/admin/categories {slug, name, image, isActive}: added at the end.
func (s *Server) handleAdminCreateCategory(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	var in categoryRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if f := s.checkCategory(&in, true); len(f) > 0 {
		return formError(f)
	}
	active := in.IsActive == nil || *in.IsActive
	_, err := s.q.InsertCategory(r.Context(), db.InsertCategoryParams{Slug: in.Slug, Name: in.Name, ImageUrl: in.Image, IsActive: active})
	if isUnique(err, "") {
		return formError(map[string]string{"slug": "Another category already uses this address."})
	}
	if err != nil {
		return err
	}
	return s.handleAdminCategories(w, r, admin)
}

// PUT /api/admin/categories/{id} {name, image, isActive}: rename, new photo,
// on/off. The web address (slug) stays, so shared links keep working.
// A category is never deleted; turned off, it leaves the shop's menu.
func (s *Server) handleAdminUpdateCategory(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in categoryRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if in.Slug != "" {
		return formError(map[string]string{"slug": "The address of a category cannot change (links were shared)."})
	}
	if f := s.checkCategory(&in, false); len(f) > 0 {
		return formError(f)
	}
	if in.IsActive == nil {
		return formError(map[string]string{"isActive": "Say if the category is on or off."})
	}
	n, err := s.q.UpdateCategory(r.Context(), db.UpdateCategoryParams{ID: id, Name: in.Name, ImageUrl: in.Image, IsActive: *in.IsActive})
	if err != nil {
		return err
	}
	if n == 0 {
		return notFound("There is no category with this id.")
	}
	return s.handleAdminCategories(w, r, admin)
}

// PUT /api/admin/categories/order {ids}: the menu order.
func (s *Server) handleAdminCategoryOrder(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	var in struct {
		IDs []int64 `json:"ids"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	err := pgx.BeginFunc(r.Context(), s.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		rows, err := q.ListAdminCategories(r.Context())
		if err != nil {
			return err
		}
		known := map[int64]bool{}
		for _, c := range rows {
			known[c.ID] = true
		}
		seen := map[int64]bool{}
		for _, id := range in.IDs {
			if !known[id] || seen[id] {
				return formError(map[string]string{"ids": "Send every category exactly once."})
			}
			seen[id] = true
		}
		if len(seen) != len(known) {
			return formError(map[string]string{"ids": "Send every category exactly once."})
		}
		for i, id := range in.IDs {
			if err := q.SetCategoryOrder(r.Context(), db.SetCategoryOrderParams{ID: id, SortOrder: int32(i + 1)}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	return s.handleAdminCategories(w, r, admin)
}

// ---------- Settings ----------

type settingJSON struct {
	settings.Rule
	Value       json.RawMessage `json:"value"`
	Description string          `json:"description"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// GET /api/admin/settings: every setting with its value and limits.
func (s *Server) handleAdminSettings(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	rows, err := s.q.ListAllSettings(r.Context())
	if err != nil {
		return err
	}
	byKey := map[string]db.Setting{}
	for _, row := range rows {
		byKey[row.Key] = row
	}
	out := []settingJSON{}
	for _, rule := range settings.Rules { // in the order of the rules (grouped for the page)
		row, ok := byKey[rule.Key]
		if !ok {
			continue
		}
		out = append(out, settingJSON{Rule: rule, Value: row.Value, Description: row.Description, UpdatedAt: row.UpdatedAt})
	}
	writeJSON(w, http.StatusOK, map[string]any{"settings": out})
	return nil
}

// PUT /api/admin/settings {values: {key: value, ...}}: all or nothing.
func (s *Server) handleAdminUpdateSettings(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	var in struct {
		Values map[string]json.RawMessage `json:"values"`
	}
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if len(in.Values) == 0 {
		return formError(map[string]string{"values": "Nothing to save."})
	}
	clean := map[string]json.RawMessage{}
	f := map[string]string{}
	for key, raw := range in.Values {
		rule, ok := settings.RuleFor(key)
		if !ok {
			f[key] = "There is no such setting."
			continue
		}
		value, problem := rule.Check(raw)
		if problem != "" {
			f[key] = problem
			continue
		}
		clean[key] = value
	}
	if hero, ok := clean["home_hero_product_slug"]; ok {
		var slug string
		_ = json.Unmarshal(hero, &slug)
		if slug != "" {
			onSale, err := s.q.ProductSlugOnSale(r.Context(), slug)
			if err != nil {
				return err
			}
			if !onSale {
				f["home_hero_product_slug"] = "Choose a published product (or none)."
			}
		}
	}
	if len(f) > 0 {
		return formError(f)
	}
	now := s.now()
	err := pgx.BeginFunc(r.Context(), s.pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		for key, value := range clean {
			if _, err := q.UpdateSetting(r.Context(), db.UpdateSettingParams{Key: key, Value: value, At: now}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	return s.handleAdminSettings(w, r, admin)
}

// ---------- Delivery ----------

type adminZone struct {
	ID            int64  `json:"id"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	ChargePaisa   int64  `json:"chargePaisa"`
	FreeOverPaisa *int64 `json:"freeOverPaisa"`
	Currency      string `json:"currency"`
	IsActive      bool   `json:"isActive"`
	ActiveAreas   int32  `json:"activeAreas"`
}

type adminArea struct {
	ID        int64  `json:"id"`
	District  string `json:"district"`
	Label     string `json:"label"`
	Hint      string `json:"hint"`
	ZoneID    int64  `json:"zoneId"`
	SortOrder int32  `json:"sortOrder"`
	IsActive  bool   `json:"isActive"`
}

// GET /api/admin/delivery: zones (charges, free-delivery amounts), every
// district area and its zone, and whether free delivery is on.
func (s *Server) handleAdminDelivery(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	zoneRows, err := s.q.ListAdminZones(r.Context())
	if err != nil {
		return err
	}
	zones := make([]adminZone, 0, len(zoneRows))
	for _, z := range zoneRows {
		zones = append(zones, adminZone{
			ID: z.ID, Code: z.Code, Name: z.Name, ChargePaisa: z.ChargePaisa, FreeOverPaisa: z.FreeOverPaisa,
			Currency: z.Currency, IsActive: z.IsActive, ActiveAreas: z.ActiveAreas,
		})
	}
	areaRows, err := s.q.ListAdminAreas(r.Context())
	if err != nil {
		return err
	}
	areas := make([]adminArea, 0, len(areaRows))
	for _, a := range areaRows {
		areas = append(areas, adminArea{ID: a.ID, District: a.District, Label: a.AreaLabel, Hint: a.Hint, ZoneID: a.ZoneID, SortOrder: a.SortOrder, IsActive: a.IsActive})
	}
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"zones": zones, "areas": areas, "freeDeliveryEnabled": set.FreeDeliveryEnabled})
	return nil
}

// maxChargePaisa: ৳10,000. Only stops typing mistakes.
const maxChargePaisa = 1_000_000

type zoneRequest struct {
	Code          string `json:"code"` // only when creating
	Name          string `json:"name"`
	ChargePaisa   int64  `json:"chargePaisa"`
	FreeOverPaisa *int64 `json:"freeOverPaisa"` // null = never free in this zone
	IsActive      *bool  `json:"isActive"`
}

var zoneCodeRe = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,29}$`)

func checkZone(in *zoneRequest, creating bool) map[string]string {
	f := map[string]string{}
	in.Name = strings.TrimSpace(in.Name)
	if n := utf8.RuneCountInString(in.Name); n < 2 || n > 60 {
		f["name"] = "Enter a short name, like Inside Dhaka."
	}
	if in.ChargePaisa < 0 || in.ChargePaisa > maxChargePaisa {
		f["chargePaisa"] = "Enter a charge from ৳0 to ৳10,000."
	}
	if in.FreeOverPaisa != nil && (*in.FreeOverPaisa <= 0 || *in.FreeOverPaisa > products.MaxPricePaisa) {
		f["freeOverPaisa"] = "Enter an amount above ৳0, or leave it empty (never free)."
	}
	if creating {
		in.Code = strings.ToUpper(strings.TrimSpace(in.Code))
		if !zoneCodeRe.MatchString(in.Code) {
			f["code"] = "Use capital letters and _, like CHATTOGRAM_CITY."
		}
	}
	return f
}

// POST /api/admin/delivery/zones {code, name, chargePaisa, freeOverPaisa}
func (s *Server) handleAdminCreateZone(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	var in zoneRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if f := checkZone(&in, true); len(f) > 0 {
		return formError(f)
	}
	_, err := s.q.InsertZone(r.Context(), db.InsertZoneParams{Code: in.Code, Name: in.Name, ChargePaisa: in.ChargePaisa, FreeOverPaisa: in.FreeOverPaisa})
	if isUnique(err, "") {
		return formError(map[string]string{"code": "Another zone already has this code."})
	}
	if err != nil {
		return err
	}
	return s.handleAdminDelivery(w, r, admin)
}

// PUT /api/admin/delivery/zones/{id} {name, chargePaisa, freeOverPaisa, isActive}
// Orders already placed keep the charge they were placed with.
func (s *Server) handleAdminUpdateZone(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in zoneRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if in.Code != "" {
		return formError(map[string]string{"code": "A zone's code cannot change (orders keep it)."})
	}
	if f := checkZone(&in, false); len(f) > 0 {
		return formError(f)
	}
	if in.IsActive == nil {
		return formError(map[string]string{"isActive": "Say if the zone is on or off."})
	}
	if !*in.IsActive {
		n, err := s.q.CountActiveAreasInZone(r.Context(), id)
		if err != nil {
			return err
		}
		if n > 0 {
			return errorf(http.StatusConflict, "ZONE_IN_USE", "%d areas still deliver in this zone. Move them to another zone first.", n)
		}
	}
	n, err := s.q.UpdateZone(r.Context(), db.UpdateZoneParams{ID: id, Name: in.Name, ChargePaisa: in.ChargePaisa, FreeOverPaisa: in.FreeOverPaisa, IsActive: *in.IsActive})
	if err != nil {
		return err
	}
	if n == 0 {
		return notFound("There is no zone with this id.")
	}
	return s.handleAdminDelivery(w, r, admin)
}

type areaRequest struct {
	District string `json:"district"` // only when creating
	Label    string `json:"label"`
	Hint     string `json:"hint"`
	ZoneID   int64  `json:"zoneId"`
	IsActive *bool  `json:"isActive"`
}

func (s *Server) checkArea(r *http.Request, in *areaRequest) (map[string]string, error) {
	f := map[string]string{}
	in.Label = strings.TrimSpace(in.Label)
	in.Hint = strings.TrimSpace(in.Hint)
	if n := utf8.RuneCountInString(in.Label); n < 2 || n > 60 {
		f["label"] = "Enter the area name, like Dhaka city."
	}
	if utf8.RuneCountInString(in.Hint) > 100 {
		f["hint"] = "Keep the hint short."
	}
	ok, err := s.q.ZoneExists(r.Context(), in.ZoneID)
	if err != nil {
		return nil, err
	}
	if !ok {
		f["zoneId"] = "Choose a zone."
	}
	return f, nil
}

// POST /api/admin/delivery/areas {district, label, hint, zoneId}: for example
// split Chattogram into "Chattogram city" and "Outside Chattogram city".
// A district with two or more areas asks the buyer to choose one.
func (s *Server) handleAdminCreateArea(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	var in areaRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	in.District = strings.TrimSpace(in.District)
	f, err := s.checkArea(r, &in)
	if err != nil {
		return err
	}
	exists, err := s.q.DistrictExists(r.Context(), in.District)
	if err != nil {
		return err
	}
	if !exists {
		f["district"] = "Choose one of the 64 districts."
	}
	if len(f) > 0 {
		return formError(f)
	}
	_, err = s.q.InsertArea(r.Context(), db.InsertAreaParams{District: in.District, AreaLabel: in.Label, Hint: in.Hint, ZoneID: in.ZoneID})
	if isUnique(err, "") {
		return formError(map[string]string{"label": "This district already has an area with this name."})
	}
	if err != nil {
		return err
	}
	return s.handleAdminDelivery(w, r, admin)
}

// PUT /api/admin/delivery/areas/{id} {label, hint, zoneId, isActive}: the
// district -> zone mapping. Orders already placed keep their charge.
func (s *Server) handleAdminUpdateArea(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var in areaRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	if in.District != "" {
		return formError(map[string]string{"district": "An area cannot move to another district. Add a new area there instead."})
	}
	f, err := s.checkArea(r, &in)
	if err != nil {
		return err
	}
	if in.IsActive == nil {
		f["isActive"] = "Say if the area is on or off."
	}
	if len(f) > 0 {
		return formError(f)
	}
	n, err := s.q.UpdateArea(r.Context(), db.UpdateAreaParams{ID: id, AreaLabel: in.Label, Hint: in.Hint, ZoneID: in.ZoneID, IsActive: *in.IsActive})
	if isUnique(err, "") {
		return formError(map[string]string{"label": "This district already has an area with this name."})
	}
	if err != nil {
		return err
	}
	if n == 0 {
		return notFound("There is no area with this id.")
	}
	return s.handleAdminDelivery(w, r, admin)
}
