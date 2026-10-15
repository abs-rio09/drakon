# DRAKON

Premium dark collectible & lifestyle brand — e-commerce website (Bangladesh, ৳, Cash on Delivery).

| Folder | What |
|---|---|
| `web/` | Frontend — Vite + React + TypeScript + Tailwind. All customer pages. Reads everything from the Go API. |
| `api/` | Backend — Go `net/http` + pgx + sqlc + goose. Catalog, checkout quote, Cash on Delivery orders, tracking, cancel, background sweep. |
| `docs/` | Blueprint, brand vision, open questions, design reference, progress logs, `api.md` (every endpoint) |

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
make run        # API on http://localhost:8080 (Ctrl+C to stop)
```

In a second terminal:

```zsh
cd ~/Desktop/projects/Drakon/drakon/web
npm install     # first time only
npm run dev     # http://localhost:5173 (Vite forwards /api to the Go server)
```

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

Roadmap steps 1–8 are done: frontend, database, Go API, real Cash on Delivery checkout, tracking and cancel, auto-cancel and auto-archive. Next: step 9, admin login and order screen. See `docs/blueprint.md` (part 10) and `docs/api.md`.
