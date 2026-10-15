package orders

import (
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/abs-rio09/drakon/api/internal/settings"
)

// Checkout is the form the buyer fills in (web/src/features/checkout/validation.ts).
// There is no price anywhere in it: prices come from the database.
type Checkout struct {
	Items          []Line `json:"items"`
	DeliveryAreaID *int64 `json:"deliveryAreaId"`
	Name           string `json:"name"`
	Phone          string `json:"phone"`
	Email          string `json:"email"`
	Area           string `json:"area"`
	Address        string `json:"address"`
	CourierNote    string `json:"courierNote"`
	IsGift         bool   `json:"isGift"`
	GiftName       string `json:"giftName"`
	GiftPhone      string `json:"giftPhone"`
	GiftNote       string `json:"giftNote"`
	HidePrices     bool   `json:"hidePrices"`
}

// Longest texts we store. Generous; they only stop abuse (the notes have
// their own limits from the settings table).
const (
	maxNameRunes    = 100
	maxEmailRunes   = 254
	maxAreaRunes    = 100
	maxAddressRunes = 500
)

var (
	bdMobile = regexp.MustCompile(`^01[3-9][0-9]{8}$`)
	emailRe  = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

// NormalizePhone cleans what people type: "+880 1712-345678" -> "01712345678".
// Same rule as the website's normalizePhone.
func NormalizePhone(input string) string {
	digits := strings.NewReplacer(" ", "", "-", "", "\t", "").Replace(strings.TrimSpace(input))
	switch {
	case strings.HasPrefix(digits, "+880"):
		digits = "0" + digits[4:]
	case strings.HasPrefix(digits, "880"):
		digits = "0" + digits[3:]
	}
	return digits
}

// IsBDMobile reports whether the input is an 11-digit Bangladesh mobile number.
func IsBDMobile(input string) bool { return bdMobile.MatchString(NormalizePhone(input)) }

func runes(s string) int { return utf8.RuneCountInString(s) }

// Validate checks the form with the same rules and messages as the website,
// trims the texts and normalizes the phone numbers. It returns one message
// per bad field (empty map = all good).
func (c *Checkout) Validate(set settings.Settings) map[string]string {
	errs := map[string]string{}
	c.Name = strings.TrimSpace(c.Name)
	c.Email = strings.TrimSpace(c.Email)
	c.Area = strings.TrimSpace(c.Area)
	c.Address = strings.TrimSpace(c.Address)
	c.CourierNote = strings.TrimSpace(c.CourierNote)
	c.GiftName = strings.TrimSpace(c.GiftName)
	c.GiftNote = strings.TrimSpace(c.GiftNote)

	switch {
	case runes(c.Name) < 2:
		errs["name"] = "Enter your full name."
	case runes(c.Name) > maxNameRunes:
		errs["name"] = "The name is too long."
	}

	if strings.TrimSpace(c.Phone) == "" {
		errs["phone"] = "Enter your phone number. We call it to confirm the order."
	} else if !IsBDMobile(c.Phone) {
		errs["phone"] = "Enter an 11-digit mobile number that starts with 01, like 01712345678."
	} else {
		c.Phone = NormalizePhone(c.Phone)
	}

	if c.Email != "" && (!emailRe.MatchString(c.Email) || runes(c.Email) > maxEmailRunes) {
		errs["email"] = "Check the email, for example you@example.com. Or leave it empty."
	}

	if c.DeliveryAreaID == nil || *c.DeliveryAreaID <= 0 {
		errs["district"] = "Choose your district."
	}

	switch {
	case c.Area == "":
		errs["area"] = "Enter your area or thana, like Mirpur 10."
	case runes(c.Area) > maxAreaRunes:
		errs["area"] = "The area is too long."
	}

	switch {
	case runes(c.Address) < 10:
		errs["address"] = "Enter your full address: house, road, block and a landmark."
	case runes(c.Address) > maxAddressRunes:
		errs["address"] = "The address is too long."
	}

	if runes(c.CourierNote) > set.CourierNoteMaxChars {
		errs["courierNote"] = "Keep the note under " + strconv.Itoa(set.CourierNoteMaxChars) + " characters."
	}

	if c.IsGift {
		switch {
		case runes(c.GiftName) < 2:
			errs["giftName"] = "Enter the receiver's name."
		case runes(c.GiftName) > maxNameRunes:
			errs["giftName"] = "The name is too long."
		}
		if strings.TrimSpace(c.GiftPhone) == "" {
			errs["giftPhone"] = "Enter the receiver's phone number. The courier calls it."
		} else if !IsBDMobile(c.GiftPhone) {
			errs["giftPhone"] = "Enter an 11-digit mobile number that starts with 01, like 01712345678."
		} else {
			c.GiftPhone = NormalizePhone(c.GiftPhone)
		}
		if runes(c.GiftNote) > set.GiftNoteMaxChars {
			errs["giftNote"] = "Keep the gift note under " + strconv.Itoa(set.GiftNoteMaxChars) + " characters."
		}
	} else {
		// Not a gift: never store gift details that were typed and then unticked.
		c.GiftName, c.GiftPhone, c.GiftNote, c.HidePrices = "", "", "", false
	}
	return errs
}
