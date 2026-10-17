# DRAKON

Premium dark collectible & lifestyle brand — e-commerce website (Bangladesh, ৳, Cash on Delivery).

| Folder | What |
|---|---|
| `web/` | Frontend — Vite + React + TypeScript + Tailwind. All customer pages and the admin panel (`/admin`). Reads everything from the Go API. `web/worker/` + `wrangler.jsonc`: the Cloudflare Worker (not deployed yet). |
| `api/` | Backend — Go `net/http` + pgx + sqlc + goose. Catalog, checkout quote, Cash on Delivery orders, tracking, cancel, background sweep, admin login and the admin API. `api/Dockerfile` for Render. |
| `docs/` | Blueprint, brand vision, open questions, design reference, progress logs, `api.md` (every endpoint), `deploy.md` (going live) |

## Run everything locally

Needs Docker, Go 1.27+ and Node 22+. Copy `.env.example` to `.env` once and set a password.

Add the Go tools folder to your PATH once (for `goose` and `sqlc`):

```zsh
echo 'export PATH="$PATH:$(go env GOPATH)/bin"' >> ~/.zshrc && source ~/.zshrc
go install github.com/pressly/goose/v3/cmd/goose@latest   # if missing
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest       # if missing
```

```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make db-up      # start PostgreSQL 18 in Docker and wait until healthy
make migrate    # apply new goose migrations to the dev database
make seed       # sample catalogue (safe to run twice)
make dev-owner  # first time: a local admin; its password goes into .env (DEV_ADMIN_PASSWORD)
make run        # API on http://localhost:8080 (Ctrl+C to stop)
```

In a second terminal:

```zsh
cd ~/Desktop/projects/Drakon/drakon/web
npm install     # first time only
npm run dev     # http://localhost:5173 (Vite forwards /api to the Go server)
```

The admin panel is at http://localhost:5173/admin (log in with `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` from `.env`). It is never linked from the shop.

## Admin accounts

| Command (in `api/`) | What |
|---|---|
| `make dev-owner` | local only: the dev Owner with a new random password, saved in the repo-root `.env` |
| `make create-owner EMAIL=you@example.com` | the real Owner, on any `DATABASE_URL` (password typed hidden, twice) |
| `make reset-password EMAIL=you@example.com` | new password, ends the lockout, logs out every browser |

## Checks

| Where | Command | What |
|---|---|---|
| `api/` | `make check` | gofmt + go vet + go test (tests use the separate `drakon_test` database, created automatically) |
| `api/` | `make sqlc` | regenerate `internal/db` after changing `db/queries` or a migration |
| `api/` | `make migrate-status` | which migrations ran |
| `web/` | `npm run build` | type-check and production build into `web/dist/` |
| `web/` | `npm run lint` | oxlint |

Open the database: `docker compose exec db psql -U drakon -d drakon`

## Status

Roadmap steps 1–10 are done: frontend, database, Go API, real Cash on Delivery checkout, tracking and cancel, auto-cancel and auto-archive, and the admin panel (login with lockout, orders with the call list, products with the price lock and stock book, categories, settings, delivery zones, blocked phones, returns). The deploy files are ready (`docs/deploy.md`); nothing is deployed. See `docs/blueprint.md` (part 10), `docs/api.md` and `docs/progress/`.
