// Package images decides where product photos live.
//
// Today the admin adds a photo by its address: a file in web/public/img
// ("/img/p-hoodie02-front.webp") or a full https:// link. Later, real
// uploads go to Cloudflare R2: write a Store whose Upload puts the file in
// R2 and returns its public link, and pass it to the server instead of
// Links. Nothing else has to change.
package images

import (
	"context"
	"errors"
	"io"
	"net/url"
	"regexp"
	"strings"
)

// Store is everything the admin code needs from photo storage.
type Store interface {
	// Check returns a cleaned photo address, or an error the admin can read.
	Check(ref string) (string, error)
	// Upload saves a new photo file and returns its address.
	Upload(ctx context.Context, name, contentType string, file io.Reader) (string, error)
}

// ErrUploadNotReady: Links cannot store files (no R2 yet).
var ErrUploadNotReady = errors.New("photo uploads are not set up yet; add the photo by its /img/ address")

const maxRefLength = 500

// localRe: a file name in web/public/img, without folders, with a photo type.
var localRe = regexp.MustCompile(`^/img/[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|jpg|jpeg|png|avif)$`)

// Links is the Store for now: it accepts addresses, it does not store files.
type Links struct{}

func (Links) Check(ref string) (string, error) {
	ref = strings.TrimSpace(ref)
	switch {
	case ref == "":
		return "", errors.New("Enter the photo address, like /img/p-my-product.webp.")
	case len(ref) > maxRefLength:
		return "", errors.New("This address is too long.")
	case strings.HasPrefix(ref, "/"):
		if strings.Contains(ref, "..") || !localRe.MatchString(ref) {
			return "", errors.New("Use a file in web/public/img, like /img/p-my-product.webp (webp, jpg, png or avif).")
		}
		return ref, nil
	}
	u, err := url.Parse(ref)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
		return "", errors.New("Use /img/… for a file on the site, or a full https:// link.")
	}
	return u.String(), nil
}

func (Links) Upload(context.Context, string, string, io.Reader) (string, error) {
	return "", ErrUploadNotReady
}
