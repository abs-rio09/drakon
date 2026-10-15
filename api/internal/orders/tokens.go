package orders

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// orderAlphabet has 32 characters: no 0/O and no 1/I, so a number read out
// on the phone is never misheard. 32 is a power of two, so "byte & 31"
// picks every character with exactly the same chance.
const orderAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

// NewOrderNumber returns "DRK-" + 6 random characters, e.g. DRK-7K3Q9P.
// 32^6 = about 1 billion possibilities, so guessing someone's number is hard.
func NewOrderNumber() string {
	b := make([]byte, 6)
	rand.Read(b) // crypto/rand: never fails on supported systems
	out := []byte("DRK-")
	for _, x := range b {
		out = append(out, orderAlphabet[x&31])
	}
	return string(out)
}

// NewTrackToken returns a secret token (shown to the buyer once) and its
// SHA-256 hash (the only thing stored). Someone who reads the database can
// not use the hash to track or cancel an order.
func NewTrackToken() (token string, hash []byte) {
	b := make([]byte, 32)
	rand.Read(b)
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, HashToken(token)
}

func HashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
