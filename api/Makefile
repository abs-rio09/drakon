# DRAKON api: short commands. Run them from the api/ folder, e.g. `make run`.
# psql runs inside the database container, so you do not need psql installed.

GOBIN := $(shell go env GOPATH)/bin
PSQL   = docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

.PHONY: db-up migrate migrate-status seed sqlc run test check

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

# Tests use the separate drakon_test database (created automatically).
test:
	go test ./...

# Everything that must pass before a commit.
check:
	@test -z "$$(gofmt -l .)" || (echo "gofmt needed:"; gofmt -l .; exit 1)
	go vet ./...
	go test ./...
