// Package money turns whole paisa into text for records the admin reads,
// the same way the website does (web/src/lib/money.ts formatTaka):
// 125000 -> "৳1,250", 210050 -> "৳2,100.50", 100000000 -> "৳10,00,000"
// (Bangladeshi grouping: the last 3 digits, then groups of 2).
// Amounts are always stored as paisa; this is only for text.
package money

import (
	"strconv"
	"strings"
)

func Taka(paisa int64) string {
	sign := ""
	u := uint64(paisa)
	if paisa < 0 {
		sign, u = "-", uint64(-(paisa+1))+1 // safe for the smallest int64 too
	}
	whole, rest := u/100, u%100
	out := sign + "৳" + group(strconv.FormatUint(whole, 10))
	if rest != 0 {
		out += "." + strconv.FormatUint(rest/10, 10) + strconv.FormatUint(rest%10, 10)
	}
	return out
}

// group puts commas into a number like the en-IN locale: 1234567 -> 12,34,567.
func group(digits string) string {
	if len(digits) <= 3 {
		return digits
	}
	head, tail := digits[:len(digits)-3], digits[len(digits)-3:]
	parts := []string{}
	for len(head) > 2 {
		parts = append([]string{head[len(head)-2:]}, parts...)
		head = head[:len(head)-2]
	}
	parts = append([]string{head}, parts...)
	return strings.Join(parts, ",") + "," + tail
}
