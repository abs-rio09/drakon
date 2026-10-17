package products

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
)

// Input is every field of the product form (all the product page shows).
// Prices and stock are not here: they belong to the variants.
type Input struct {
	Name          string   `json:"name"`
	Slug          string   `json:"slug"` // empty = made from the name
	CategorySlug  string   `json:"categorySlug"`
	Kind          string   `json:"kind"`        // "Tech toy"
	VariantKind   string   `json:"variantKind"` // "Size", "Material"
	IsLimited     bool     `json:"isLimited"`
	EditionSize   *int32   `json:"editionSize"`   // null = not shown
	PurchaseLimit *int32   `json:"purchaseLimit"` // null = the settings default
	Summary       string   `json:"summary"`
	Story         []string `json:"story"` // paragraphs
	Details       []Detail `json:"details"`
	SuccessorSlug *string  `json:"successorSlug"` // a newer edition
	FeaturedOrder *int32   `json:"featuredOrder"` // place in "the current drop"
}

// Limits on what the form may contain. They only stop mistakes and abuse.
const (
	maxNameRunes      = 120
	maxSlugRunes      = 80
	maxKindRunes      = 60
	maxSummaryRunes   = 600
	maxParagraphs     = 20
	maxParagraphRunes = 2000
	maxDetails        = 30
	maxTermRunes      = 60
	maxDetailRunes    = 500
	maxPurchaseLimit  = 50
	maxEditionSize    = 1_000_000
	maxFeaturedOrder  = 99
)

var slugRe = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// Slugify makes a web address part from a name:
// "Founders Playcard Deck · II" -> "founders-playcard-deck-ii".
func Slugify(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(name) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	return strings.TrimRight(b.String(), "-")
}

func runes(s string) int { return utf8.RuneCountInString(s) }

// clean trims the texts and checks every field. It returns one message per
// bad field (an empty map = all good).
func (in *Input) clean() map[string]string {
	f := map[string]string{}
	in.Name = strings.TrimSpace(in.Name)
	in.Slug = strings.TrimSpace(strings.ToLower(in.Slug))
	in.CategorySlug = strings.TrimSpace(in.CategorySlug)
	in.Kind = strings.TrimSpace(in.Kind)
	in.VariantKind = strings.TrimSpace(in.VariantKind)
	in.Summary = strings.TrimSpace(in.Summary)

	switch {
	case runes(in.Name) < 2:
		f["name"] = "Enter the product name."
	case runes(in.Name) > maxNameRunes:
		f["name"] = "The name is too long."
	}
	if in.Slug == "" {
		in.Slug = Slugify(in.Name)
	}
	if !slugRe.MatchString(in.Slug) || runes(in.Slug) > maxSlugRunes {
		f["slug"] = "Use small letters, numbers and dashes only, like founders-deck-ii."
	}
	if in.CategorySlug == "" {
		f["categorySlug"] = "Choose a category."
	}
	switch {
	case in.Kind == "":
		f["kind"] = "Say what it is, like “Collectible card”."
	case runes(in.Kind) > maxKindRunes:
		f["kind"] = "Keep it short."
	}
	if in.VariantKind == "" {
		in.VariantKind = "Edition"
	}
	if runes(in.VariantKind) > maxKindRunes {
		f["variantKind"] = "Keep it short."
	}
	if runes(in.Summary) > maxSummaryRunes {
		f["summary"] = fmt.Sprintf("Keep the summary under %d characters.", maxSummaryRunes)
	}

	story := []string{}
	for _, p := range in.Story {
		if p = strings.TrimSpace(p); p != "" {
			story = append(story, p)
		}
	}
	in.Story = story
	if len(story) > maxParagraphs {
		f["story"] = fmt.Sprintf("At most %d paragraphs.", maxParagraphs)
	}
	for _, p := range story {
		if runes(p) > maxParagraphRunes {
			f["story"] = "One paragraph is too long."
		}
	}

	details := []Detail{}
	for _, d := range in.Details {
		d.Term, d.Text = strings.TrimSpace(d.Term), strings.TrimSpace(d.Text)
		if d.Term == "" && d.Text == "" {
			continue
		}
		if d.Term == "" || d.Text == "" || runes(d.Term) > maxTermRunes || runes(d.Text) > maxDetailRunes {
			f["details"] = "Every detail needs a short name and a text."
		}
		details = append(details, d)
	}
	in.Details = details
	if len(details) > maxDetails {
		f["details"] = fmt.Sprintf("At most %d details.", maxDetails)
	}

	if in.EditionSize != nil && (*in.EditionSize < 1 || *in.EditionSize > maxEditionSize) {
		f["editionSize"] = "Enter how many pieces the run has, or leave it empty."
	}
	if in.PurchaseLimit != nil && (*in.PurchaseLimit < 1 || *in.PurchaseLimit > maxPurchaseLimit) {
		f["purchaseLimit"] = fmt.Sprintf("Use 1 to %d, or leave it empty for the default.", maxPurchaseLimit)
	}
	if in.FeaturedOrder != nil && (*in.FeaturedOrder < 1 || *in.FeaturedOrder > maxFeaturedOrder) {
		f["featuredOrder"] = fmt.Sprintf("Use 1 to %d, or leave it empty.", maxFeaturedOrder)
	}
	if in.SuccessorSlug != nil {
		s := strings.TrimSpace(*in.SuccessorSlug)
		if s == "" {
			in.SuccessorSlug = nil
		} else {
			in.SuccessorSlug = &s
		}
	}
	return f
}

// resolve turns the category and successor slugs into ids.
func (in *Input) resolve(ctx context.Context, q *db.Queries, selfID int64) (categoryID int64, successorID *int64, err error) {
	categoryID, err = q.GetCategoryIDBySlug(ctx, in.CategorySlug)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil, invalid(map[string]string{"categorySlug": "This category does not exist."})
	}
	if err != nil {
		return 0, nil, err
	}
	if in.SuccessorSlug != nil {
		id, err := q.GetProductIDBySlugAny(ctx, *in.SuccessorSlug)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil, invalid(map[string]string{"successorSlug": "There is no product with this address."})
		}
		if err != nil {
			return 0, nil, err
		}
		if id == selfID {
			return 0, nil, invalid(map[string]string{"successorSlug": "A product cannot follow itself."})
		}
		successorID = &id
	}
	return categoryID, successorID, nil
}

// uniqueError turns a duplicate slug or featured place into a clear refusal.
func uniqueError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		switch pgErr.ConstraintName {
		case "products_slug_key":
			return invalid(map[string]string{"slug": "Another product already uses this address."})
		case "products_featured_order_key":
			return invalid(map[string]string{"featuredOrder": "Another product already has this place in the drop."})
		case "product_variants_sku_key":
			return invalid(map[string]string{"sku": "Another variant already uses this SKU."})
		}
	}
	return err
}

func writeDetails(ctx context.Context, q *db.Queries, productID int64, details []Detail) error {
	if err := q.DeleteProductDetails(ctx, productID); err != nil {
		return err
	}
	for i, d := range details {
		if err := q.InsertProductDetail(ctx, db.InsertProductDetailParams{
			ProductID: productID, Term: d.Term, Text: d.Text, SortOrder: int32(i),
		}); err != nil {
			return err
		}
	}
	return nil
}

// Create adds a new product. It always starts as DRAFT (hidden from the shop).
func Create(ctx context.Context, pool *pgxpool.Pool, in Input, now time.Time) (int64, error) {
	if f := in.clean(); len(f) > 0 {
		return 0, invalid(f)
	}
	var id int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		categoryID, successorID, err := in.resolve(ctx, q, 0)
		if err != nil {
			return err
		}
		id, err = q.InsertProduct(ctx, db.InsertProductParams{
			CategoryID: categoryID, Slug: in.Slug, Name: in.Name, Kind: in.Kind, VariantKind: in.VariantKind,
			Summary: in.Summary, Story: in.Story, IsLimited: in.IsLimited, EditionSize: in.EditionSize,
			PurchaseLimit: in.PurchaseLimit, SuccessorID: successorID, FeaturedOrder: in.FeaturedOrder, At: now,
		})
		if err != nil {
			return uniqueError(err)
		}
		return writeDetails(ctx, q, id, in.Details)
	})
	return id, err
}

// Update saves the product form. Once a product has left DRAFT, three
// things are locked because buyers rely on them: the web address (links
// were shared), "limited" (exclusivity) and the edition size (a promise).
func Update(ctx context.Context, pool *pgxpool.Pool, id int64, in Input, now time.Time) error {
	if f := in.clean(); len(f) > 0 {
		return invalid(f)
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		if _, err := q.LockProduct(ctx, id); err != nil {
			return notFoundAs(err, errNoProduct)
		}
		cur, err := q.GetAdminProduct(ctx, id)
		if err != nil {
			return err
		}
		if cur.Status != db.ProductStatusDRAFT {
			f := map[string]string{}
			if in.Slug != cur.Slug {
				f["slug"] = "The address is locked once the product is published (links were shared)."
			}
			if in.IsLimited != cur.IsLimited {
				f["isLimited"] = "“Limited” is locked once the product is published."
			}
			if !sameInt(in.EditionSize, cur.EditionSize) {
				f["editionSize"] = "The edition size is locked once the product is published."
			}
			if len(f) > 0 {
				return &Error{Status: 409, Code: "LOCKED", Message: "Some fields cannot change on a published product.", Fields: f}
			}
		}
		categoryID, successorID, err := in.resolve(ctx, q, id)
		if err != nil {
			return err
		}
		if err := q.UpdateProduct(ctx, db.UpdateProductParams{
			ID: id, CategoryID: categoryID, Slug: in.Slug, Name: in.Name, Kind: in.Kind, VariantKind: in.VariantKind,
			Summary: in.Summary, Story: in.Story, IsLimited: in.IsLimited, EditionSize: in.EditionSize,
			PurchaseLimit: in.PurchaseLimit, SuccessorID: successorID, FeaturedOrder: in.FeaturedOrder, At: now,
		}); err != nil {
			return uniqueError(err)
		}
		return writeDetails(ctx, q, id, in.Details)
	})
}

func sameInt(a, b *int32) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}
