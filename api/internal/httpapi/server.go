// Package httpapi is the HTTP layer: routes, JSON in and out, and errors.
// Business rules live in other packages (orders, catalog ...); handlers only
// read the request, call them, and write the answer.
package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/images"
	"github.com/abs-rio09/drakon/api/internal/ratelimit"
)

type Server struct {
	pool *pgxpool.Pool
	q    *db.Queries
	log  *slog.Logger
	opts Options
	// images checks (and later uploads) product photos. Links for now;
	// Cloudflare R2 later (internal/images).
	images images.Store
	// now returns the current time. Tests can replace it.
	now func() time.Time
	// limiter counts tries per IP for login, orders, track and cancel
	// (ratelimit.go). In memory: fine for one server process.
	limiter *ratelimit.Limiter
}

// Options are the security settings from the config (internal/config).
type Options struct {
	CookieSecure   bool     // "Secure" flag on the admin cookie
	AllowedOrigins []string // sites allowed to send admin changes
	TrustedProxy   string   // "" or "cloudflare": who may tell us the visitor's IP
	ProxySecret    string   // proves a request came through our Worker
}

func NewServer(pool *pgxpool.Pool, logger *slog.Logger, opts Options) *Server {
	auth.WarmUp()
	s := &Server{pool: pool, q: db.New(pool), log: logger, opts: opts, images: images.Links{}, now: time.Now}
	s.limiter = ratelimit.New(func() time.Time { return s.now() })
	return s
}

// handlerFunc is like http.HandlerFunc but may return an error. An *apiError
// is sent to the client as it is; any other error becomes a plain 500, and
// the details go only to the server log (never to the client).
type handlerFunc func(w http.ResponseWriter, r *http.Request) error

func (s *Server) wrap(h handlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := h(w, r)
		if err == nil {
			return
		}
		var apiErr *apiError
		if errors.As(err, &apiErr) {
			writeError(w, apiErr)
			return
		}
		if errors.Is(err, context.Canceled) {
			// The browser went away; nobody is waiting for an answer.
			return
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "22021" {
			// PostgreSQL cannot store this text (a NUL character, \u0000).
			// That is the visitor's input, not our bug: 400, not 500.
			writeError(w, badRequest("BAD_TEXT", "Some text contains a character we cannot save. Remove it and try again."))
			return
		}
		s.log.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
		writeError(w, errorf(http.StatusInternalServerError, "INTERNAL", "Something went wrong on our side. Please try again."))
	}
}

// Handler returns every route of the API, wrapped in the middleware.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	s.routes(mux)
	return s.recoverPanics(s.logRequests(securityHeaders(s.guardAdmin(mux))))
}

func (s *Server) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", s.wrap(s.handleHealth))

	// Public catalog
	mux.HandleFunc("GET /api/categories", s.wrap(s.handleCategories))
	mux.HandleFunc("GET /api/products", s.wrap(s.handleProducts))
	mux.HandleFunc("GET /api/products/featured", s.wrap(s.handleFeatured))
	mux.HandleFunc("GET /api/products/{slug}", s.wrap(s.handleProduct))
	mux.HandleFunc("GET /api/sold-out", s.wrap(s.handleSoldOut))
	mux.HandleFunc("GET /api/delivery/areas", s.wrap(s.handleDeliveryAreas))
	mux.HandleFunc("GET /api/settings/public", s.wrap(s.handlePublicSettings))

	// Checkout and orders (Cash on Delivery only)
	mux.HandleFunc("POST /api/checkout/quote", s.wrap(s.handleQuote))
	// Rate limited per IP (ratelimit.go, limits in settings).
	mux.HandleFunc("POST /api/orders", s.wrap(s.limited("order", orderLimit, s.handlePlaceOrder)))
	mux.HandleFunc("POST /api/orders/track", s.wrap(s.limited("track", trackLimit, s.handleTrackOrder)))
	mux.HandleFunc("POST /api/orders/cancel", s.wrap(s.limited("cancel", cancelLimit, s.handleCancelOrder)))

	// Admin (admin_routes.go). Every route except login needs a session.
	mux.HandleFunc("POST /api/admin/login", s.wrap(s.limited("login", loginLimit, s.handleAdminLogin)))
	for _, rt := range s.adminRoutes() {
		mux.HandleFunc(rt.Method+" "+rt.Path, s.adminOnly(rt.Handler))
	}

	// Any other /api path: a JSON 404 instead of Go's plain text one.
	mux.HandleFunc("/api/", s.wrap(func(w http.ResponseWriter, r *http.Request) error {
		return notFound("There is no such API endpoint.")
	}))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) error {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.pool.Ping(ctx); err != nil {
		s.log.Error("health: database ping failed", "err", err)
		return errorf(http.StatusServiceUnavailable, "DATABASE_DOWN", "The database is not reachable.")
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "database": "ok"})
	return nil
}

// securityHeaders are sent with every API answer: the browser must not
// guess other content types, must not show an answer inside a frame, and
// gets no Referer to pass on.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

// recoverPanics turns a crash inside a handler into a 500 answer. The stack
// trace goes to the log only.
func (s *Server) recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				s.log.Error("panic", "path", r.URL.Path, "value", v, "stack", string(debug.Stack()))
				writeError(w, errorf(http.StatusInternalServerError, "INTERNAL", "Something went wrong on our side. Please try again."))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// logRequests writes one log line per request: method, path, status, time.
// It never logs bodies, so phone numbers and addresses stay out of the log.
func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		s.log.Info("http", "method", r.Method, "path", r.URL.Path, "status", rec.status,
			"ms", time.Since(start).Milliseconds())
	})
}
