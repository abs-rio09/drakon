package orders

import (
	"regexp"
	"testing"
)

func TestNewOrderNumber(t *testing.T) {
	re := regexp.MustCompile(`^DRK-[2-9A-HJ-NP-Z]{6}$`)
	seen := map[string]bool{}
	for range 2000 {
		n := NewOrderNumber()
		if !re.MatchString(n) {
			t.Fatalf("bad number %q", n)
		}
		seen[n] = true
	}
	if len(seen) < 1990 {
		t.Fatalf("too many repeats: %d unique of 2000", len(seen))
	}
}

func TestTrackTokenHash(t *testing.T) {
	token, hash := NewTrackToken()
	if len(token) != 43 || len(hash) != 32 {
		t.Fatalf("token %d chars, hash %d bytes", len(token), len(hash))
	}
	if string(HashToken(token)) != string(hash) {
		t.Fatal("hash does not match")
	}
	other, _ := NewTrackToken()
	if other == token {
		t.Fatal("two tokens are equal")
	}
}

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"01712345678":      "01712345678",
		"+880 1712-345678": "01712345678",
		"8801712345678":    "01712345678",
		" 017 1234 5678 ":  "01712345678",
		// Phones often paste a no-break space (U+00A0) or a line break; the
		// website removes every kind of space (JS \s), so the server must too.
		"01712\u00a0345678":    "01712345678",
		"+880\u00a01712345678": "01712345678",
		"01712345678\n":        "01712345678",
		// Chrome autofill formats. Same table as the website's
		// validation.test.ts: the server must clean exactly like the browser.
		"(182) 967-9208":   "01829679208",
		"1829679208":       "01829679208",
		"+880 1829-679208": "01829679208",
		"8801829679208":    "01829679208",
		"01829679208":      "01829679208",
		"018 2967 9208":    "01829679208",
		"01829.679.208":    "01829679208",
	}
	for in, want := range cases {
		if got := NormalizePhone(in); got != want {
			t.Errorf("NormalizePhone(%q) = %q, want %q", in, got, want)
		}
		if !IsBDMobile(in) {
			t.Errorf("%q should be a valid mobile", in)
		}
	}
	for _, bad := range []string{"", "0171234567", "01212345678", "abc", "+8801712345678999",
		"12345", "02829679208", "01229679208", "+1 (182) 967-9208 1", "+880 01712345678"} {
		if IsBDMobile(bad) {
			t.Errorf("%q should not be a valid mobile", bad)
		}
	}
}

func TestNormalizeLinesMerges(t *testing.T) {
	got, err := normalizeLines([]Line{{1, 2}, {2, 1}, {1, 3}})
	if err != nil || len(got) != 2 || got[0].Qty != 5 || got[1].Qty != 1 {
		t.Fatalf("got %v %v", got, err)
	}
	if _, err := normalizeLines(nil); err == nil {
		t.Fatal("empty cart must fail")
	}
}

func TestVariantName(t *testing.T) {
	if VariantName("Size", "M") != "Size M" || VariantName("Material", "Metal") != "Metal" {
		t.Fatal("wrong variant name")
	}
}
