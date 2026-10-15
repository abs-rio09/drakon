// Package catalog loads products from the database in the shape the website
// uses (close to the TypeScript types in web/src/lib/types.ts).
package catalog

import (
	"context"
	"time"

	"github.com/abs-rio09/drakon/api/internal/db"
)

type Category struct {
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Image string `json:"image"`
}

type Detail struct {
	Term string `json:"term"`
	Text string `json:"text"`
}

type Image struct {
	Src   string `json:"src"`
	Thumb string `json:"thumb"`
	Name  string `json:"name"`
	Alt   string `json:"alt"`
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
}

type Product struct {
	ID            int64      `json:"id"`
	Slug          string     `json:"slug"`
	Name          string     `json:"name"`
	CategorySlug  string     `json:"categorySlug"`
	Kind          string     `json:"kind"`
	VariantKind   string     `json:"variantKind"`
	IsLimited     bool       `json:"isLimited"`
	EditionSize   *int32     `json:"editionSize"`
	Status        string     `json:"status"`
	PurchaseLimit *int32     `json:"purchaseLimit"` // null = settings default
	Summary       string     `json:"summary"`
	Story         []string   `json:"story"`
	Details       []Detail   `json:"details"`
	Images        []Image    `json:"images"`
	Variants      []Variant  `json:"variants"`
	SoldOutAt     *time.Time `json:"soldOutAt"`
	SuccessorSlug *string    `json:"successorSlug"`
}

// ListCategories returns the active categories in menu order.
func ListCategories(ctx context.Context, q *db.Queries) ([]Category, error) {
	rows, err := q.ListCategories(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Category, 0, len(rows))
	for _, r := range rows {
		out = append(out, Category{Slug: r.Slug, Name: r.Name, Image: r.ImageUrl})
	}
	return out, nil
}

// LoadProducts returns full products for the given ids, in the same order.
// Ids of DRAFT or unknown products are skipped. It runs 4 queries in total,
// however many products there are (not 4 per product).
func LoadProducts(ctx context.Context, q *db.Queries, ids []int64) ([]Product, error) {
	out := []Product{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := q.GetProductsByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[int64]*Product, len(rows))
	for _, r := range rows {
		story := r.Story
		if story == nil {
			story = []string{}
		}
		byID[r.ID] = &Product{
			ID: r.ID, Slug: r.Slug, Name: r.Name, CategorySlug: r.CategorySlug,
			Kind: r.Kind, VariantKind: r.VariantKind, IsLimited: r.IsLimited,
			EditionSize: r.EditionSize, Status: string(r.Status), PurchaseLimit: r.PurchaseLimit,
			Summary: r.Summary, Story: story, SoldOutAt: r.SoldOutAt, SuccessorSlug: r.SuccessorSlug,
			Details: []Detail{}, Images: []Image{}, Variants: []Variant{},
		}
	}

	details, err := q.ListDetailsForProducts(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, d := range details {
		if p := byID[d.ProductID]; p != nil {
			p.Details = append(p.Details, Detail{Term: d.Term, Text: d.Text})
		}
	}
	images, err := q.ListImagesForProducts(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, i := range images {
		if p := byID[i.ProductID]; p != nil {
			p.Images = append(p.Images, Image{Src: i.Url, Thumb: i.ThumbUrl, Name: i.ShortName, Alt: i.Alt})
		}
	}
	variants, err := q.ListVariantsForProducts(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, v := range variants {
		if p := byID[v.ProductID]; p != nil {
			p.Variants = append(p.Variants, Variant{
				ID: v.ID, SKU: v.Sku, Label: v.Label, Note: v.Note, PricePaisa: v.PricePaisa,
				Currency: v.Currency, Stock: v.Stock, ImageIndex: v.ImageIndex,
			})
		}
	}

	for _, id := range ids {
		if p := byID[id]; p != nil {
			out = append(out, *p)
		}
	}
	return out, nil
}

// Related picks up to count products on sale for the product page:
// the same category first, then the others. shop is the list of products
// on sale (already in shop order).
func Related(product Product, shop []Product, count int) []Product {
	same := []Product{}
	rest := []Product{}
	for _, p := range shop {
		switch {
		case p.ID == product.ID:
		case p.CategorySlug == product.CategorySlug:
			same = append(same, p)
		default:
			rest = append(rest, p)
		}
	}
	all := append(same, rest...)
	if len(all) > count {
		all = all[:count]
	}
	return all
}
