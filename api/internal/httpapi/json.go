package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// maxBodyBytes is the largest request body we accept (1 MB).
const maxBodyBytes = 1 << 20

// apiError is an error the client is allowed to see. Every error response
// has the same shape: {"error":{"code":"UPPER_SNAKE","message":"..."}}.
// Fields (optional) maps a form field to its problem, for 422 errors.
type apiError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
	// Problems lists the cart items that stop an order (409 answers).
	Problems any `json:"problems,omitempty"`
}

func (e *apiError) Error() string { return e.Code + ": " + e.Message }

func errorf(status int, code, format string, args ...any) *apiError {
	return &apiError{Status: status, Code: code, Message: fmt.Sprintf(format, args...)}
}

func notFound(message string) *apiError {
	return errorf(http.StatusNotFound, "NOT_FOUND", "%s", message)
}

func badRequest(code, message string) *apiError {
	return errorf(http.StatusBadRequest, code, "%s", message)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	// The status line is already sent, so an encode error can only be logged
	// by the caller's middleware; there is nothing useful to send.
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, e *apiError) {
	writeJSON(w, e.Status, map[string]*apiError{"error": e})
}

// decodeJSON reads one JSON object from the request body into dst.
// It refuses bodies over 1 MB, unknown fields and anything after the object,
// and turns every problem into a friendly 400 error.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
		return errorf(http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Send the body as application/json.")
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var syntaxErr *json.SyntaxError
		var typeErr *json.UnmarshalTypeError
		var maxErr *http.MaxBytesError
		switch {
		case errors.Is(err, io.EOF):
			return badRequest("BAD_JSON", "The request body is empty.")
		case errors.As(err, &maxErr):
			return errorf(http.StatusRequestEntityTooLarge, "BODY_TOO_LARGE", "The request body must be at most 1 MB.")
		case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
			return badRequest("BAD_JSON", "The request body is not valid JSON.")
		case errors.As(err, &typeErr) && typeErr.Field == "":
			// The whole body has the wrong type ([], "x", 123): no field to name.
			return badRequest("BAD_JSON", "The request body must be a JSON object (between { and }).")
		case errors.As(err, &typeErr):
			return badRequest("BAD_JSON", fmt.Sprintf("The field %q has the wrong type.", typeErr.Field))
		case strings.HasPrefix(err.Error(), "json: unknown field "):
			field := strings.TrimPrefix(err.Error(), "json: unknown field ")
			return badRequest("UNKNOWN_FIELD", fmt.Sprintf("The field %s is not allowed.", field))
		default:
			return badRequest("BAD_JSON", "The request body could not be read.")
		}
	}
	if dec.More() {
		return badRequest("BAD_JSON", "The request body must contain a single JSON object.")
	}
	return nil
}
