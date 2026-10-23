---
name: drakon-new-migration
description: How to change the DRAKON database schema safely with a new goose migration (api/db/migrations), regenerate sqlc and prove the Down step works. Use when adding or changing a table, column, index, enum or CHECK in DRAKON.
---

# A new DRAKON migration

Rules (CLAUDE.md hard rule 10): schema changes only through a **new** goose file. Never edit a file that has been applied (00001–00006 and anything newer in `api/db/migrations/`).

## Steps
1. Next zero-padded number: `ls api/db/migrations` → e.g. `00007_<what>.sql`.
2. Start with a comment block: what and why, the blueprint rule it serves, and "Never edit this file after it has been applied."
3. `-- +goose Up` then the change; `-- +goose Down` that undoes it exactly (drop in reverse order, drop enum types last).
4. Money: `BIGINT` `*_paisa` with a CHECK (`> 0` for prices, `>= 0` for charges/refunds) and a `currency TEXT NOT NULL DEFAULT 'BDT'` column. Never float.
5. Foreign keys: default `NO ACTION`. Never `ON DELETE CASCADE` on anything that leads to orders or products (rule 5: nothing is deleted).
6. Business numbers go into `settings` rows (with a rule in `api/internal/settings/rules.go`), never into code.
7. `cd api && make sqlc` after changing a migration or `db/queries/*.sql`; commit the generated `internal/db` files with it. A second `make sqlc` must give no diff.

## Prove it (on a throwaway database, never on `drakon`)
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE drakon_mig"'
# GOOSE_DBSTRING = the DATABASE_URL from ../.env with the database name drakon_mig (do not print it)
goose up && goose down-to 0 && goose up      # every Down must work
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE drakon_mig WITH (FORCE)"'
make check                                    # tests rebuild drakon_test from all migrations
```
Then `make migrate` applies it to the dev database. Ask Abu Bakkar Siddik before running anything against Neon.

## Index or not
Add an index only when `EXPLAIN ANALYZE` on realistic data (tens of thousands of generated rows, not the tiny seed) shows a slow sequential scan on a query the app really runs. `ILIKE '%text%'` cannot use a B-tree index (pg_trgm would be needed).
