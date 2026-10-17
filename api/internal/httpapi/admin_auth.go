package httpapi

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// adminCookie holds the session token. Path=/api/admin: the browser sends
// it only to admin API calls, never to the shop's own requests.
const adminCookie = "drakon_admin"

// adminHandlerFunc is a handler that runs only for a logged-in admin.
type adminHandlerFunc func(w http.ResponseWriter, r *http.Request, admin auth.Admin) error

// adminRoute is one row of the admin route table (admin_routes.go).
type adminRoute struct {
	Method  string
	Path    string
	Handler adminHandlerFunc
}

func isAdminPath(path string) bool {
	return path == "/api/admin" || strings.HasPrefix(path, "/api/admin/")
}

// guardAdmin runs before every /api/admin request, also unknown paths:
//   - Cache-Control: no-store, so no browser or proxy keeps admin data
//   - X-Robots-Tag: noindex, so search engines never list it
//   - CSRF guard: a request that changes something (anything but GET/HEAD/
//     OPTIONS) must carry an Origin header from ALLOWED_ORIGINS, else 403.
//     A strange website cannot make the admin's browser send changes,
//     because the browser always tells us the real origin.
func (s *Server) guardAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isAdminPath(r.URL.Path) {
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Robots-Tag", "noindex, nofollow")
			if !safeMethod(r.Method) && !slices.Contains(s.opts.AllowedOrigins, r.Header.Get("Origin")) {
				writeError(w, errorf(http.StatusForbidden, "BAD_ORIGIN", "This change did not come from the DRAKON admin site."))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func safeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}

func notLoggedIn() *apiError {
	return errorf(http.StatusUnauthorized, "UNAUTHORIZED", "Please log in.")
}

// adminOnly checks the session cookie and passes the admin to h.
// No cookie, an unknown token, an expired session: 401.
func (s *Server) adminOnly(h adminHandlerFunc) http.HandlerFunc {
	return s.wrap(func(w http.ResponseWriter, r *http.Request) error {
		token := sessionToken(r)
		admin, err := auth.Authenticate(r.Context(), s.q, token, s.now())
		if errors.Is(err, auth.ErrNoSession) {
			if token != "" {
				s.clearAdminCookie(w) // a dead cookie: tell the browser to drop it
			}
			return notLoggedIn()
		}
		if err != nil {
			return err
		}
		return h(w, r, admin)
	})
}

func sessionToken(r *http.Request) string {
	c, err := r.Cookie(adminCookie)
	if err != nil {
		return ""
	}
	return c.Value
}

func (s *Server) setAdminCookie(w http.ResponseWriter, sess *auth.Session) {
	http.SetCookie(w, &http.Cookie{
		Name: adminCookie, Value: sess.Token, Path: "/api/admin",
		Expires: sess.ExpiresAt, MaxAge: int(auth.SessionMax.Seconds()),
		HttpOnly: true, // JavaScript cannot read it, so an injected script cannot steal it
		Secure:   s.opts.CookieSecure,
		SameSite: http.SameSiteLaxMode, // not sent with requests that other sites start (forms, images)
	})
}

func (s *Server) clearAdminCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: adminCookie, Value: "", Path: "/api/admin", MaxAge: -1,
		HttpOnly: true, Secure: s.opts.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// POST /api/admin/login {email, password} -> sets the session cookie.
// A wrong email, a wrong password and a paused account all get the same
// 401 INVALID_LOGIN answer.
func (s *Server) handleAdminLogin(w http.ResponseWriter, r *http.Request) error {
	var in loginRequest
	if err := decodeJSON(w, r, &in); err != nil {
		return err
	}
	fields := map[string]string{}
	if strings.TrimSpace(in.Email) == "" {
		fields["email"] = "Enter your email."
	}
	if in.Password == "" {
		fields["password"] = "Enter your password."
	}
	if len(fields) > 0 {
		return &apiError{Status: http.StatusUnprocessableEntity, Code: "VALIDATION", Message: "Fill in both fields.", Fields: fields}
	}
	set, err := settings.Load(r.Context(), s.q)
	if err != nil {
		return err
	}
	sess, err := auth.Login(r.Context(), s.pool, in.Email, in.Password, s.now())
	if errors.Is(err, auth.ErrInvalidLogin) {
		return errorf(http.StatusUnauthorized, "INVALID_LOGIN",
			"Wrong email or password. After %d wrong tries in a row, login pauses for %d minutes.",
			set.LoginMaxFailures, set.LoginLockoutMinutes)
	}
	if err != nil {
		return err
	}
	s.setAdminCookie(w, sess)
	writeJSON(w, http.StatusOK, map[string]any{"admin": sess.Admin})
	return nil
}

// POST /api/admin/logout: deletes the session and the cookie.
func (s *Server) handleAdminLogout(w http.ResponseWriter, r *http.Request, _ auth.Admin) error {
	if err := auth.Logout(r.Context(), s.q, sessionToken(r)); err != nil {
		return err
	}
	s.clearAdminCookie(w)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	return nil
}

// GET /api/admin/me: who is logged in. The web uses it to decide between
// the admin pages and the login page.
func (s *Server) handleAdminMe(w http.ResponseWriter, r *http.Request, admin auth.Admin) error {
	writeJSON(w, http.StatusOK, map[string]any{"admin": admin})
	return nil
}
