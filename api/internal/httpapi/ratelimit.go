package httpapi

import (
	"crypto/subtle"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"time"

	"github.com/abs-rio09/drakon/api/internal/config"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// Headers our Cloudflare Worker (web/worker/index.ts) adds to every /api
// request: the visitor's IP (copied from CF-Connecting-IP, which Cloudflare
// sets and a visitor cannot change) and the shared secret that proves the
// request really came through the Worker.
const (
	clientIPHeader    = "X-Drakon-Client-IP"
	proxySecretHeader = "X-Drakon-Proxy-Secret"
)

// rateLimit picks the tries and the window (in minutes) of one action
// from the settings.
type rateLimit func(settings.Settings) (tries, minutes int)

func loginLimit(s settings.Settings) (int, int)  { return s.RateLoginTries, s.RateLoginMinutes }
func orderLimit(s settings.Settings) (int, int)  { return s.RateOrderTries, s.RateOrderMinutes }
func trackLimit(s settings.Settings) (int, int)  { return s.RateTrackTries, s.RateTrackMinutes }
func cancelLimit(s settings.Settings) (int, int) { return s.RateCancelTries, s.RateCancelMinutes }

// limited counts the request for this visitor's IP before h runs. Over the
// limit: 429 TOO_MANY_TRIES with a Retry-After header, and h never runs.
// For login that matters: a refused try never reaches the password check,
// so it does not count towards pausing the Owner's account.
func (s *Server) limited(action string, limit rateLimit, h handlerFunc) handlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		set, err := settings.Load(r.Context(), s.q)
		if err != nil {
			return err
		}
		tries, minutes := limit(set)
		ok, wait := s.limiter.Allow(action+"|"+s.clientIP(r), tries, time.Duration(minutes)*time.Minute)
		if !ok {
			return tooManyTries(w, wait)
		}
		return h(w, r)
	}
}

func tooManyTries(w http.ResponseWriter, wait time.Duration) error {
	seconds := int((wait + time.Second - 1) / time.Second) // round up: never "0"
	if seconds < 1 {
		seconds = 1
	}
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	if seconds <= 60 {
		return errorf(http.StatusTooManyRequests, "TOO_MANY_TRIES", "Too many tries. Please wait a minute and try again.")
	}
	return errorf(http.StatusTooManyRequests, "TOO_MANY_TRIES",
		"Too many tries. Please wait %d minutes and try again.", (seconds+59)/60)
}

// clientIP is the visitor's address, as the key for the rate limits.
// By default it is the direct connection's address: headers like
// X-Forwarded-For are ignored, because anyone can send them with any IP
// and so get a fresh limit for every request. Only with
// TRUSTED_PROXY=cloudflare, and only when the request carries the Worker's
// secret, do we take the IP the Worker passes on.
func (s *Server) clientIP(r *http.Request) string {
	if s.opts.TrustedProxy == config.TrustedProxyCloudflare && s.opts.ProxySecret != "" &&
		subtle.ConstantTimeCompare([]byte(r.Header.Get(proxySecretHeader)), []byte(s.opts.ProxySecret)) == 1 {
		if ip, err := netip.ParseAddr(r.Header.Get(clientIPHeader)); err == nil {
			return ipKey(ip)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if ip, err := netip.ParseAddr(host); err == nil {
		return ipKey(ip)
	}
	return host
}

// ipKey groups IPv6 addresses by their /64 network: one home or phone
// usually gets a whole /64, so counting single IPv6 addresses would let one
// visitor switch addresses for a fresh limit.
func ipKey(ip netip.Addr) string {
	ip = ip.Unmap()
	if ip.Is6() {
		p, _ := ip.Prefix(64)
		return p.String()
	}
	return ip.String()
}
