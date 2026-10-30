#!/usr/bin/env bash
# Read-only smoke test of a running DRAKON site. Only GET requests:
# it never logs in, never places an order and never changes data.
#
#   scripts/smoke.sh https://drakon.abubakkar.workers.dev [https://drakon-api-uq0h.onrender.com]
#
# The first address is the website (the Worker, or http://localhost:5173 in dev).
# The optional second one is the API itself, checked directly as well.
# Prints OK / FAIL per check; exits 1 if any check failed.
set -u

SITE=${1:-}
API=${2:-}
if [[ -z $SITE ]]; then
  echo "usage: $0 SITE_URL [API_URL]" >&2
  exit 2
fi
SITE=${SITE%/}
API=${API%/}

fails=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# fetch NAME URL: saves the status code, headers and body of one GET.
# A sleeping Render server can take ~60 s to wake up, hence the long timeout.
fetch() {
  curl -sS -m 90 -o "$tmp/$1.body" -D "$tmp/$1.head" -w '%{http_code}' "$2" >"$tmp/$1.code" 2>"$tmp/$1.err" ||
    echo 000 >"$tmp/$1.code"
}

# check LABEL COMMAND...: prints OK or FAIL for one condition.
check() {
  local label=$1
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'OK    %s\n' "$label"
  else
    printf 'FAIL  %s\n' "$label"
    fails=$((fails + 1))
  fi
}

status_is() { [[ $(cat "$tmp/$1.code") == "$2" ]]; }
body_has() { grep -qF -- "$2" "$tmp/$1.body"; }
header_has() { grep -qiE "^$2:.*$3" "$tmp/$1.head"; }

if [[ -n $API ]]; then
  fetch api "$API/api/health"
  check "API  GET /api/health is 200"           status_is api 200
  check "API  database is ok"                   body_has api '"database":"ok"'
fi

fetch home "$SITE/"
check "SITE GET / is 200"                       status_is home 200
check "SITE / is HTML"                          header_has home content-type text/html
check "SITE / X-Frame-Options DENY"             header_has home x-frame-options DENY
check "SITE / X-Content-Type-Options nosniff"   header_has home x-content-type-options nosniff
check "SITE / Referrer-Policy is set"           header_has home referrer-policy .
check "SITE / CSP frame-ancestors 'none'"       header_has home content-security-policy "frame-ancestors 'none'"

fetch health "$SITE/api/health"
check "SITE GET /api/health is 200 (via Worker)" status_is health 200
check "SITE database is ok"                     body_has health '"database":"ok"'

fetch cats "$SITE/api/categories"
check "SITE GET /api/categories is 200"         status_is cats 200
check "SITE categories answer is JSON"          body_has cats '"categories"'

fetch areas "$SITE/api/delivery/areas"
check "SITE GET /api/delivery/areas is 200"     status_is areas 200
check "SITE delivery areas are listed"          body_has areas '"districts"'

fetch settings "$SITE/api/settings/public"
check "SITE GET /api/settings/public is 200"    status_is settings 200

fetch admin "$SITE/admin/login"
check "SITE GET /admin/login is 200"            status_is admin 200
check "SITE /admin noindex"                     header_has admin x-robots-tag noindex
check "SITE /admin no-store"                    header_has admin cache-control no-store

fetch me "$SITE/api/admin/me"
check "SITE /api/admin/me without login is 401" status_is me 401
check "SITE /api/admin noindex"                 header_has me x-robots-tag noindex
check "SITE /api/admin no-store"                header_has me cache-control no-store

if ((fails > 0)); then
  echo "$fails check(s) failed."
  exit 1
fi
echo "All checks passed."
