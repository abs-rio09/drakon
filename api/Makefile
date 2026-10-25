# DRAKON api: short commands. Run them from the api/ folder, e.g. `make run`.
# psql runs inside the database container, so you do not need psql installed.

GOBIN := $(shell go env GOPATH)/bin
PSQL   = docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

.PHONY: db-up migrate migrate-status seed sqlc run test check dev-owner create-owner reset-password reset-dev

# Start the local PostgreSQL container and wait until it is healthy.
db-up:
	docker compose up -d --wait db

# Apply new migrations to the dev database. goose reads the repo-root .env
# (GOOSE_DRIVER, GOOSE_DBSTRING, GOOSE_MIGRATION_DIR), so it runs from there.
migrate:
	cd .. && $(GOBIN)/goose up

migrate-status:
	cd .. && $(GOBIN)/goose status

# Fill the dev database with the sample catalogue. Safe to run twice.
seed:
	$(PSQL) < db/seed/dev_seed.sql

# Regenerate internal/db from db/queries and db/migrations.
sqlc:
	$(GOBIN)/sqlc generate

# Start the API on http://localhost:8080 (Ctrl+C to stop).
run:
	go run ./cmd/server

# Local dev only: an Owner with a random password, saved in the repo-root
# .env as DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD. Run again for a new password.
dev-owner:
	go run ./cmd/admin dev-owner

# Local dev only: delete every order and reload the sample catalogue
# (asks you to type "reset <database>"; refuses any non-localhost database).
reset-dev:
	go run ./cmd/admin reset-dev

# The real Owner (any DATABASE_URL, e.g. Neon): make create-owner EMAIL=you@example.com
create-owner:
	go run ./cmd/admin create-owner --email "$(EMAIL)"

reset-password:
	go run ./cmd/admin reset-password --email "$(EMAIL)"

# Tests use the separate drakon_test database (created automatically).
test:
	go test ./...

# Everything that must pass before a commit.
check:
	@test -z "$$(gofmt -l .)" || (echo "gofmt needed:"; gofmt -l .; exit 1)
	go vet ./...
	go test ./...
