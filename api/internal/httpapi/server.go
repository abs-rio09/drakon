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

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/db"
)

type Server struct {
	pool *pgxpool.Pool
	q    *db.Queries
	log  *slog.Logger
	// now returns the current time. Tests can replace it.
	now func() time.Time
}

func NewServer(pool *pgxpool.Pool, logger *slog.Logger) *Server {
	return &Server{pool: pool, q: db.New(pool), log: logger, now: time.Now}
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
		s.log.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
		writeError(w, errorf(http.StatusInternalServerError, "INTERNAL", "Something went wrong on our side. Please try again."))
	}
}

// Handler returns every route of the API, wrapped in the middleware.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	s.routes(mux)
	return s.recoverPanics(s.logRequests(mux))
}

func (s *Server) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", s.wrap(s.handleHealth))

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
