package money

import (
	"math"
	"testing"
)

// The same answers as formatTaka on the website (Intl en-IN).
func TestTaka(t *testing.T) {
	for paisa, want := range map[int64]string{
		0:             "৳0",
		5:             "৳0.05",
		50:            "৳0.50",
		59950:         "৳599.50",
		125000:        "৳1,250",
		160050:        "৳1,600.50",
		210050:        "৳2,100.50",
		10000000:      "৳1,00,000",
		100000000:     "৳10,00,000",
		123456789:     "৳12,34,567.89",
		-125000:       "-৳1,250",
		math.MinInt64: "-৳92,23,37,20,36,85,47,758.08",
	} {
		if got := Taka(paisa); got != want {
			t.Errorf("Taka(%d) = %q, want %q", paisa, got, want)
		}
	}
}
