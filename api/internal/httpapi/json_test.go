package httpapi

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSON(t *testing.T) {
	type payload struct {
		Name string `json:"name"`
		Qty  int    `json:"qty"`
	}
	cases := []struct {
		name, body, wantCode string
	}{
		{"ok", `{"name":"a","qty":1}`, ""},
		{"empty", ``, "BAD_JSON"},
		{"broken", `{"name":`, "BAD_JSON"},
		{"wrong type", `{"qty":"two"}`, "BAD_JSON"},
		{"unknown field", `{"name":"a","price":1}`, "UNKNOWN_FIELD"},
		{"two objects", `{"name":"a"}{"name":"b"}`, "BAD_JSON"},
		{"too large", `{"name":"` + strings.Repeat("x", maxBodyBytes) + `"}`, "BODY_TOO_LARGE"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			var p payload
			err := decodeJSON(httptest.NewRecorder(), req, &p)
			if tc.wantCode == "" {
				if err != nil {
					t.Fatalf("unexpected error %v", err)
				}
				return
			}
			var apiErr *apiError
			if !errors.As(err, &apiErr) || apiErr.Code != tc.wantCode {
				t.Fatalf("got %v, want code %s", err, tc.wantCode)
			}
		})
	}
}

func TestDecodeJSONRejectsOtherContentType(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "text/plain")
	var v struct{}
	var apiErr *apiError
	if err := decodeJSON(httptest.NewRecorder(), req, &v); !errors.As(err, &apiErr) || apiErr.Status != http.StatusUnsupportedMediaType {
		t.Fatalf("got %v", err)
	}
}

// A body that is not an object ([] or "x" or 123) names no field, so the
// message must not read `The field "" has the wrong type.`
func TestDecodeJSONNotAnObject(t *testing.T) {
	for _, body := range []string{`[]`, `"x"`, `123`, `true`} {
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		var v struct {
			Name string `json:"name"`
		}
		var apiErr *apiError
		err := decodeJSON(httptest.NewRecorder(), req, &v)
		if !errors.As(err, &apiErr) || apiErr.Code != "BAD_JSON" || apiErr.Message != "The request body must be a JSON object (between { and })." {
			t.Errorf("%s: got %v", body, err)
		}
	}
}
