---
name: drakon-admin-route
description: Checklist for adding or changing a DRAKON admin API endpoint (/api/admin/...) in Go and the admin web page that calls it. Use when building any admin feature in api/internal/httpapi or web/src/pages/admin.
---

# A new DRAKON admin route

## Go (api/)
1. Handler signature: `func (s *Server) handleX(w http.ResponseWriter, r *http.Request, admin auth.Admin) error`. Business rules live in `internal/orders` or `internal/products`, not in the handler.
2. Register it **only** in the table in `api/internal/httpapi/admin_routes.go` (that wraps it in `adminOnly`: session cookie → 401).
3. Add the same method + path to the table in `TestEveryAdminRouteNeedsASession` (`admin_test.go`). The test fails if one is missing.
4. Changes (POST/PUT/PATCH/DELETE) are covered by `guardAdmin`'s Origin check automatically. Tests and curl need `-H 'Origin: http://localhost:5173'`.
5. Read the body with `decodeJSON` (1 MB limit, unknown fields refused). Validate in a `clean()` that returns one message per field → 422 `VALIDATION` with `fields`. Count text with `utf8.RuneCountInString` (Bangla letters are 3 bytes).
6. Refusals by a rule: a 409 with an UPPER_SNAKE code and a plain-English message. Never put Go or SQL error text in an answer; any other error becomes a plain 500 and only the log sees it. A NUL character in text is already a 400 `BAD_TEXT` (in `wrap`).
7. A change that matters for money, stock or status: one transaction, lock rows in the order variant → product (same as checkout), and record who did it (`by_admin_id`, a history / events / movements row).
8. Answers with personal data (name, phone, address) only on admin routes; never log bodies or query strings.
9. Document it in `docs/api.md` (path, body, example curl, error codes).

## Tests (api/internal/httpapi/*_test.go)
`s := newTestServer(t, true)`, `c := loginOwner(t, s)`, `c.do("POST", path, body)`, `errorCode(body)`, `queryInt(t, sql, args...)`. Add: the happy path, every refusal code, odd input (the route is picked up by `TestEveryBodyRouteRefusesBadBodies`), and two requests at the same moment if it changes stock or status.

## Web (web/src/)
API call in `features/admin/adminApi.ts` (`adminFetch` / `adminPost`); button actions through `useAction().run(...)` so busy and error states look the same everywhere; tap targets at least 44 px; check at 390 px wide.

Run: `cd api && make check` and `cd web && npm run build && npm run lint` (with `set -o pipefail` if you pipe the output).
