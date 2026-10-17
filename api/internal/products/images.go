package products

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/images"
)

// ImageInput: a photo by its address (images.Store checks it).
type ImageInput struct {
	URL       string `json:"url"`
	ThumbURL  string `json:"thumbUrl"` // small square crop; empty = the same photo
	ShortName string `json:"shortName"`
	Alt       string `json:"alt"` // what the photo shows, for blind visitors
}

const (
	maxAltRunes       = 200
	maxShortNameRunes = 40
)

func (in *ImageInput) clean(store images.Store) map[string]string {
	f := map[string]string{}
	in.ShortName = strings.TrimSpace(in.ShortName)
	in.Alt = strings.TrimSpace(in.Alt)
	url, err := store.Check(in.URL)
	if err != nil {
		f["url"] = err.Error()
	}
	in.URL = url
	if strings.TrimSpace(in.ThumbURL) == "" {
		in.ThumbURL = in.URL
	} else if thumb, err := store.Check(in.ThumbURL); err != nil {
		f["thumbUrl"] = err.Error()
	} else {
		in.ThumbURL = thumb
	}
	switch {
	case in.Alt == "":
		f["alt"] = "Describe the photo in a few words (people who cannot see it hear this)."
	case runes(in.Alt) > maxAltRunes:
		f["alt"] = "Keep the description shorter."
	}
	if runes(in.ShortName) > maxShortNameRunes {
		f["shortName"] = "Keep the short name to a word or two, like Back."
	}
	return f
}

// AddImage adds a photo at the end. The first photo is the cover.
func AddImage(ctx context.Context, pool *pgxpool.Pool, store images.Store, productID int64, in ImageInput, now time.Time) error {
	if f := in.clean(store); len(f) > 0 {
		return invalid(f)
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		if _, err := q.LockProduct(ctx, productID); err != nil {
			return notFoundAs(err, errNoProduct)
		}
		if _, err := q.InsertImage(ctx, db.InsertImageParams{
			ProductID: productID, Url: in.URL, ThumbUrl: in.ThumbURL, ShortName: in.ShortName, Alt: in.Alt,
		}); err != nil {
			return err
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: productID, At: now})
	})
}

// UpdateImage changes a photo's address, short name or description.
func UpdateImage(ctx context.Context, pool *pgxpool.Pool, store images.Store, imageID int64, in ImageInput, now time.Time) (int64, error) {
	if f := in.clean(store); len(f) > 0 {
		return 0, invalid(f)
	}
	var productID int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		img, err := q.GetImage(ctx, imageID)
		if err != nil {
			return notFoundAs(err, errNoImage)
		}
		productID = img.ProductID
		if _, err := q.LockProduct(ctx, img.ProductID); err != nil {
			return err
		}
		if err := q.UpdateImage(ctx, db.UpdateImageParams{
			ID: imageID, Url: in.URL, ThumbUrl: in.ThumbURL, ShortName: in.ShortName, Alt: in.Alt,
		}); err != nil {
			return err
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: img.ProductID, At: now})
	})
	return productID, err
}

// placeImages writes the photos in the new order and moves every variant's
// image_index along, so each variant keeps showing the same photo.
// before = the photos as they were; order = the remaining ids, new order.
// A variant whose photo is gone shows no special photo (NULL).
func placeImages(ctx context.Context, q *db.Queries, productID int64, before []db.ListAdminImagesRow, order []int64) error {
	newPos := map[int64]int32{}
	for i, id := range order {
		newPos[id] = int32(i)
		if err := q.SetImageOrder(ctx, db.SetImageOrderParams{ID: id, SortOrder: int32(i)}); err != nil {
			return err
		}
	}
	variants, err := q.ListAdminVariants(ctx, productID)
	if err != nil {
		return err
	}
	for _, v := range variants {
		if v.ImageIndex == nil {
			continue
		}
		var next *int32
		if int(*v.ImageIndex) < len(before) {
			if pos, ok := newPos[before[*v.ImageIndex].ID]; ok {
				next = &pos
			}
		}
		if !sameInt(next, v.ImageIndex) {
			if err := q.SetVariantImageIndex(ctx, db.SetVariantImageIndexParams{ID: v.ID, ImageIndex: next}); err != nil {
				return err
			}
		}
	}
	return nil
}

// ReorderImages puts the photos in a new order (the first one is the cover).
// ids must be exactly the product's photo ids.
func ReorderImages(ctx context.Context, pool *pgxpool.Pool, productID int64, ids []int64, now time.Time) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		if _, err := q.LockProduct(ctx, productID); err != nil {
			return notFoundAs(err, errNoProduct)
		}
		before, err := q.ListAdminImages(ctx, productID)
		if err != nil {
			return err
		}
		seen := map[int64]bool{}
		for _, id := range ids {
			seen[id] = true
		}
		same := len(ids) == len(before) && len(seen) == len(ids)
		for _, img := range before {
			same = same && seen[img.ID]
		}
		if !same {
			return invalid(map[string]string{"ids": "Send every photo of this product exactly once."})
		}
		if err := placeImages(ctx, q, productID, before, ids); err != nil {
			return err
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: productID, At: now})
	})
}

// RemoveImage takes a photo off the product (the product itself stays).
// A product in the shop always keeps at least one photo.
func RemoveImage(ctx context.Context, pool *pgxpool.Pool, imageID int64, now time.Time) (int64, error) {
	var productID int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		img, err := q.GetImage(ctx, imageID)
		if err != nil {
			return notFoundAs(err, errNoImage)
		}
		productID = img.ProductID
		p, err := q.LockProduct(ctx, img.ProductID)
		if err != nil {
			return err
		}
		before, err := q.ListAdminImages(ctx, img.ProductID)
		if err != nil {
			return err
		}
		if p.Status != db.ProductStatusDRAFT && len(before) <= 1 {
			return refuse("LAST_PHOTO", "A published product needs at least one photo. Add another photo first.")
		}
		rest := []int64{}
		for _, b := range before {
			if b.ID != imageID {
				rest = append(rest, b.ID)
			}
		}
		if err := q.DeleteImage(ctx, imageID); err != nil {
			return err
		}
		if err := placeImages(ctx, q, img.ProductID, before, rest); err != nil {
			return err
		}
		return q.TouchProduct(ctx, db.TouchProductParams{ID: img.ProductID, At: now})
	})
	return productID, err
}
