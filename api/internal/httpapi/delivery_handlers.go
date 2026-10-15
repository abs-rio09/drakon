package httpapi

import (
	"net/http"

	"github.com/abs-rio09/drakon/api/internal/settings"
)

type zoneJSON struct {
	Code          string `json:"code"`
	Name          string `json:"name"`
	ChargePaisa   int64  `json:"chargePaisa"`
	FreeOverPaisa *int64 `json:"freeOverPaisa"`
	Currency      string `json:"currency"`
}

type areaJSON struct {
	ID       int64  `json:"id"`
	Label    string `json:"label"`
	Hint     string `json:"hint"`
	ZoneCode string `json:"zoneCode"`
}

type districtJSON struct {
	Name  string     `json:"name"`
	Areas []areaJSON `json:"areas"`
}

// GET /api/delivery/areas: districts A to Z, each with its areas. A district
// with more than one area (Dhaka) asks the buyer to choose one.
func (s *Server) handleDeliveryAreas(w http.ResponseWriter, r *http.Request) error {
	zoneRows, err := s.q.ListDeliveryZones(r.Context())
	if err != nil {
		return err
	}
	zones := make([]zoneJSON, 0, len(zoneRows))
	for _, z := range zoneRows {
		zones = append(zones, zoneJSON{Code: z.Code, Name: z.Name, ChargePaisa: z.ChargePaisa, FreeOverPaisa: z.FreeOverPaisa, Currency: z.Currency})
	}

	areaRows, err := s.q.ListDeliveryAreas(r.Context())
	if err != nil {
		return err
	}
	districts := []districtJSON{}
	for _, a := range areaRows { // already sorted by district
		if len(districts) == 0 || districts[len(districts)-1].Name != a.District {
			districts = append(districts, districtJSON{Name: a.District, Areas: []areaJSON{}})
		}
		d := &districts[len(districts)-1]
		d.Areas = append(d.Areas, areaJSON{ID: a.ID, Label: a.AreaLabel, Hint: a.Hint, ZoneCode: a.ZoneCode})
	}

	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"zones": zones, "districts": districts, "freeDeliveryEnabled": set.FreeDeliveryEnabled,
	})
	return nil
}

// GET /api/settings/public: only the numbers the website needs to show.
func (s *Server) handlePublicSettings(w http.ResponseWriter, r *http.Request) error {
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"codConfirmHours":      set.CodConfirmHours,
		"defaultPurchaseLimit": set.DefaultPurchaseLimit,
		"returnDays":           set.ReturnDays,
		"lowStockThreshold":    set.LowStockThreshold,
		"giftNoteMaxChars":     set.GiftNoteMaxChars,
		"courierNoteMaxChars":  set.CourierNoteMaxChars,
		"currency":             "BDT",
	})
	return nil
}
