package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/abs-rio09/drakon/api/internal/testdb"
)

// testDB is the drakon_test database, shared by every test in this package.
var testDB *testdb.DB

func TestMain(m *testing.M) {
	db, err := testdb.Setup(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "test database:", err)
		os.Exit(1)
	}
	testDB = db
	code := m.Run()
	db.Close()
	os.Exit(code)
}

// testOrigin is the admin site the test server trusts (the Vite dev server).
const testOrigin = "http://localhost:5173"

// newTestServer empties the test database, loads the sample catalogue
// (when withSeed is true) and returns a Server that uses it.
func newTestServer(t *testing.T, withSeed bool) *Server {
	t.Helper()
	if err := testDB.Reset(context.Background(), withSeed); err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return NewServer(testDB.Pool, logger, Options{CookieSecure: true, AllowedOrigins: []string{testOrigin}})
}

// do sends one request through the full handler (routes + middleware) and
// returns the status and the decoded JSON body.
func do(t *testing.T, s *Server, method, path string, body any) (int, map[string]any) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		if raw, ok := body.(string); ok {
			reader = bytes.NewBufferString(raw)
		} else {
			b, err := json.Marshal(body)
			if err != nil {
				t.Fatal(err)
			}
			reader = bytes.NewReader(b)
		}
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	var out map[string]any
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("%s %s: body is not JSON: %s", method, path, rec.Body.String())
		}
	}
	return rec.Code, out
}

// errorCode returns error.code from an error response, or "".
func errorCode(body map[string]any) string {
	e, _ := body["error"].(map[string]any)
	code, _ := e["code"].(string)
	return code
}

func TestHealth(t *testing.T) {
	s := newTestServer(t, false)
	status, body := do(t, s, http.MethodGet, "/api/health", nil)
	if status != http.StatusOK || body["database"] != "ok" {
		t.Fatalf("health = %d %v", status, body)
	}
}

func TestUnknownEndpointIsJSON404(t *testing.T) {
	s := newTestServer(t, false)
	status, body := do(t, s, http.MethodGet, "/api/nope", nil)
	if status != http.StatusNotFound || errorCode(body) != "NOT_FOUND" {
		t.Fatalf("got %d %v", status, body)
	}
}
