package images

import (
	"context"
	"strings"
	"testing"
)

func TestLinksCheck(t *testing.T) {
	ok := map[string]string{
		"/img/p-hoodie02-front.webp":          "/img/p-hoodie02-front.webp",
		"  /img/t-c-df-paper.webp ":           "/img/t-c-df-paper.webp",
		"https://images.example.com/a/b.webp": "https://images.example.com/a/b.webp",
	}
	for in, want := range ok {
		got, err := Links{}.Check(in)
		if err != nil || got != want {
			t.Errorf("Check(%q) = %q, %v", in, got, err)
		}
	}
	for _, bad := range []string{
		"", "/img/../.env", "/img/sub/x.webp", "/img/x.svg", "/etc/passwd", "img/x.webp",
		"http://example.com/x.webp", "javascript:alert(1)", "https://user:pw@example.com/x.webp",
		"/img/" + strings.Repeat("a", 600) + ".webp",
	} {
		if _, err := (Links{}).Check(bad); err == nil {
			t.Errorf("Check(%q) was accepted", bad)
		}
	}
}

func TestLinksCannotUploadYet(t *testing.T) {
	var s Store = Links{}
	if _, err := s.Upload(context.Background(), "a.webp", "image/webp", strings.NewReader("x")); err != ErrUploadNotReady {
		t.Fatalf("Upload err = %v", err)
	}
}
