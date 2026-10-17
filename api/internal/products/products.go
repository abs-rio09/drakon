// Package products holds the admin's product rules (docs/blueprint.md,
// part 2 rules 9 and 10, part 8 "Product work"):
//   - a new product is always DRAFT; DRAFT -> ACTIVE <-> SOLD_OUT -> ARCHIVED
//   - prices change freely only in DRAFT; once live, only the Owner's
//     price fix with a written reason (recorded as a PRICE_FIX event)
//   - every stock change has a reason and a row in inventory_movements,
//     and stock never goes below 0
//   - a limited product is never restocked once SOLD_OUT or ARCHIVED
//   - products are never deleted (there is no delete here at all)
package products

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/abs-rio09/drakon/api/internal/db"
)

// Error is a refusal the admin can read. Status is the HTTP status the
// handler sends: 404, 409 (a rule says no) or 422 (a form field is wrong).
type Error struct {
	Status  int
	Code    string
	Message string
	Fields  map[string]string
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func invalid(fields map[string]string) *Error {
	return &Error{Status: http.StatusUnprocessableEntity, Code: "VALIDATION", Message: "Some details need fixing.", Fields: fields}
}

func refuse(code, message string) *Error {
	return &Error{Status: http.StatusConflict, Code: code, Message: message}
}

var errNoProduct = &Error{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: "There is no product with this id."}
var errNoVariant = &Error{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: "There is no variant with this id."}
var errNoImage = &Error{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: "There is no photo with this id."}

func notFoundAs(err error, e *Error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return e
	}
	return err
}

// ---------- What the admin sees ----------

type Image struct {
	ID        int64  `json:"id"`
	URL       string `json:"url"`
	ThumbURL  string `json:"thumbUrl"`
	ShortName string `json:"shortName"`
	Alt       string `json:"alt"`
	SortOrder int32  `json:"sortOrder"`
}

type Variant struct {
	ID         int64  `json:"id"`
	SKU        string `json:"sku"`
	Label      string `json:"label"`
	Note       string `json:"note"`
	PricePaisa int64  `json:"pricePaisa"`
	Currency   string `json:"currency"`
	Stock      int32  `json:"stock"`
	ImageIndex *int32 `json:"imageIndex"`
	SortOrder  int32  `json:"sortOrder"`
	IsActive   bool   `json:"isActive"`
}

type Detail struct {
	Term string `json:"term"`
	Text string `json:"text"`
}

type Event struct {
	Type       string    `json:"type"`
	Actor      string    `json:"actor"`
	Reason     string    `json:"reason"`
	OldValue   *string   `json:"oldValue"`
	NewValue   *string   `json:"newValue"`
	AdminEmail *string   `json:"adminEmail"`
	At         time.Time `json:"at"`
}

type Movement struct {
	VariantID   int64     `json:"variantId"`
	SKU         string    `json:"sku"`
	Change      int32     `json:"change"`
	Reason      string    `json:"reason"`
	Note        string    `json:"note"`
	OrderNumber *string   `json:"orderNumber"`
	AdminEmail  *string   `json:"adminEmail"`
	At          time.Time `json:"at"`
}

type Product struct {
	ID            int64      `json:"id"`
	Slug          string     `json:"slug"`
	Name          string     `json:"name"`
	CategorySlug  string     `json:"categorySlug"`
	CategoryName  string     `json:"categoryName"`
	Kind          string     `json:"kind"`
	VariantKind   string     `json:"variantKind"`
	Status        string     `json:"status"`
	IsLimited     bool       `json:"isLimited"`
	EditionSize   *int32     `json:"editionSize"`
	PurchaseLimit *int32     `json:"purchaseLimit"`
	Summary       string     `json:"summary"`
	Story         []string   `json:"story"`
	Details       []Detail   `json:"details"`
	SuccessorSlug *string    `json:"successorSlug"`
	FeaturedOrder *int32     `json:"featuredOrder"`
	SoldOutAt     *time.Time `json:"soldOutAt"`
	ArchivedAt    *time.Time `json:"archivedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	Images        []Image    `json:"images"`
	Variants      []Variant  `json:"variants"`
	TotalStock    int32      `json:"totalStock"`
	Events        []Event    `json:"events"`
	Movements     []Movement `json:"movements"`
	// Why Publish would be refused right now (empty = it can be published).
	PublishProblems []string `json:"publishProblems"`
}

// Load returns everything the product edit page shows.
func Load(ctx context.Context, q *db.Queries, id int64) (*Product, error) {
	r, err := q.GetAdminProduct(ctx, id)
	if err != nil {
		return nil, notFoundAs(err, errNoProduct)
	}
	p := &Product{
		ID: r.ID, Slug: r.Slug, Name: r.Name, CategorySlug: r.CategorySlug, CategoryName: r.CategoryName,
		Kind: r.Kind, VariantKind: r.VariantKind, Status: string(r.Status), IsLimited: r.IsLimited,
		EditionSize: r.EditionSize, PurchaseLimit: r.PurchaseLimit, Summary: r.Summary, Story: r.Story,
		SuccessorSlug: r.SuccessorSlug, FeaturedOrder: r.FeaturedOrder, SoldOutAt: r.SoldOutAt,
		ArchivedAt: r.ArchivedAt, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		Details: []Detail{}, Images: []Image{}, Variants: []Variant{}, Events: []Event{}, Movements: []Movement{},
		PublishProblems: []string{},
	}
	if p.Story == nil {
		p.Story = []string{}
	}
	details, err := q.ListAdminDetails(ctx, id)
	if err != nil {
		return nil, err
	}
	for _, d := range details {
		p.Details = append(p.Details, Detail{Term: d.Term, Text: d.Text})
	}
	imgs, err := q.ListAdminImages(ctx, id)
	if err != nil {
		return nil, err
	}
	for _, i := range imgs {
		p.Images = append(p.Images, Image{ID: i.ID, URL: i.Url, ThumbURL: i.ThumbUrl, ShortName: i.ShortName, Alt: i.Alt, SortOrder: i.SortOrder})
	}
	vars, err := q.ListAdminVariants(ctx, id)
	if err != nil {
		return nil, err
	}
	for _, v := range vars {
		p.Variants = append(p.Variants, Variant{
			ID: v.ID, SKU: v.Sku, Label: v.Label, Note: v.Note, PricePaisa: v.PricePaisa, Currency: v.Currency,
			Stock: v.Stock, ImageIndex: v.ImageIndex, SortOrder: v.SortOrder, IsActive: v.IsActive,
		})
		if v.IsActive {
			p.TotalStock += v.Stock
		}
	}
	events, err := q.ListProductEvents(ctx, id)
	if err != nil {
		return nil, err
	}
	for _, e := range events {
		p.Events = append(p.Events, Event{
			Type: string(e.Type), Actor: string(e.Actor), Reason: e.Reason, OldValue: e.OldValue,
			NewValue: e.NewValue, AdminEmail: e.AdminEmail, At: e.CreatedAt,
		})
	}
	moves, err := q.ListProductMovements(ctx, id)
	if err != nil {
		return nil, err
	}
	for _, m := range moves {
		p.Movements = append(p.Movements, Movement{
			VariantID: m.VariantID, SKU: m.Sku, Change: m.Change, Reason: string(m.Reason), Note: m.Note,
			OrderNumber: m.OrderNumber, AdminEmail: m.AdminEmail, At: m.CreatedAt,
		})
	}
	if r.Status == db.ProductStatusDRAFT {
		p.PublishProblems = publishProblems(p)
	}
	return p, nil
}

// publishProblems: the rules Publish checks, in words for the edit page.
func publishProblems(p *Product) []string {
	problems := []string{}
	if len(p.Images) == 0 {
		problems = append(problems, "Add at least one photo.")
	}
	priced, stock := 0, int32(0)
	for _, v := range p.Variants {
		if v.IsActive && v.PricePaisa > 0 {
			priced++
			stock += v.Stock
		}
	}
	if priced == 0 {
		problems = append(problems, "Add at least one active variant with a price.")
	}
	if p.IsLimited && priced > 0 && stock == 0 {
		problems = append(problems, "A limited run needs stock before it goes live (otherwise it is sold out at once).")
	}
	return problems
}

// ListRow is one line of the products list.
type ListRow struct {
	ID            int64      `json:"id"`
	Slug          string     `json:"slug"`
	Name          string     `json:"name"`
	Status        string     `json:"status"`
	IsLimited     bool       `json:"isLimited"`
	CategorySlug  string     `json:"categorySlug"`
	CategoryName  string     `json:"categoryName"`
	Thumb         string     `json:"thumb"`
	VariantCount  int32      `json:"variantCount"`
	EmptyVariants int32      `json:"emptyVariants"`
	TotalStock    int32      `json:"totalStock"`
	MinPricePaisa int64      `json:"minPricePaisa"`
	MaxPricePaisa int64      `json:"maxPricePaisa"`
	FeaturedOrder *int32     `json:"featuredOrder"`
	SoldOutAt     *time.Time `json:"soldOutAt"`
	ArchivedAt    *time.Time `json:"archivedAt"`
}

// List returns every product (any status) matching the filters.
func List(ctx context.Context, q *db.Queries, status *db.ProductStatus, category, pattern *string) ([]ListRow, error) {
	rows, err := q.ListAdminProducts(ctx, db.ListAdminProductsParams{Status: status, Category: category, Pattern: pattern})
	if err != nil {
		return nil, err
	}
	out := make([]ListRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, ListRow{
			ID: r.ID, Slug: r.Slug, Name: r.Name, Status: string(r.Status), IsLimited: r.IsLimited,
			CategorySlug: r.CategorySlug, CategoryName: r.CategoryName, Thumb: r.Thumb,
			VariantCount: r.VariantCount, EmptyVariants: r.EmptyVariants, TotalStock: r.TotalStock,
			MinPricePaisa: r.MinPricePaisa, MaxPricePaisa: r.MaxPricePaisa, FeaturedOrder: r.FeaturedOrder,
			SoldOutAt: r.SoldOutAt, ArchivedAt: r.ArchivedAt,
		})
	}
	return out, nil
}

// event writes a product_events row for an admin action.
func event(ctx context.Context, q *db.Queries, productID int64, t db.ProductEventType, reason string, old, next *string, adminID int64, now time.Time) error {
	return q.InsertProductEvent(ctx, db.InsertProductEventParams{
		ProductID: productID, Type: t, Actor: db.ActorTypeADMIN, Reason: reason,
		OldValue: old, NewValue: next, At: now, ByAdminID: &adminID,
	})
}

func strp(s string) *string { return &s }
