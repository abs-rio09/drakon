# DRAKON api: short commands. Run them from the api/ folder, e.g. `make seed`.
# psql runs inside the database container, so you do not need psql installed.

PSQL = docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

.PHONY: seed

# Fill the dev database with the sample catalogue. Safe to run twice.
seed:
	$(PSQL) < db/seed/dev_seed.sql
