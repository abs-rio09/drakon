// Package testdb prepares the drakon_test database for integration tests.
//
// Safety: it only ever resets a database whose name ends in "_test". The
// dev database (drakon) is used only to run CREATE DATABASE drakon_test once.
package testdb

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" driver for goose
	"github.com/pressly/goose/v3"

	dbfiles "github.com/abs-rio09/drakon/api/db"
	"github.com/abs-rio09/drakon/api/internal/config"
)

const testDBName = "drakon_test"

// lockKey is a number all test packages agree on. Holding this Postgres
// advisory lock means "I am using drakon_test right now", so two packages
// that run at the same time take turns instead of wiping each other's data.
const lockKey = 7_336_001

// tables that tests fill. Reset empties them.
var appTables = []string{
	"return_items", "returns", "admin_sessions", "admins",
	"product_events", "inventory_movements", "blocked_phones", "payments",
	"order_status_history", "order_items", "orders",
	"product_variants", "product_images", "product_details", "products", "categories",
	"delivery_areas", "delivery_zones", "settings",
}

// tables whose starting rows come from the migrations. Setup copies them
// into the test_snapshot schema, and Reset puts them back.
var migrationDataTables = []string{"settings", "delivery_zones", "delivery_areas"}

type DB struct {
	Pool *pgxpool.Pool
	URL  string
	lock *pgx.Conn
}

// Setup creates drakon_test if needed, waits for the lock, wipes it and runs
// every migration. Call it once per package from TestMain, and Close at the end.
func Setup(ctx context.Context) (*DB, error) {
	findDotEnv()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		base = os.Getenv("DATABASE_URL")
	}
	if base == "" {
		return nil, errors.New("set DATABASE_URL (or TEST_DATABASE_URL) in .env to run the tests")
	}
	testURL, err := withDatabase(base, testDBName)
	if err != nil {
		return nil, err
	}
	if err := createIfMissing(ctx, base); err != nil {
		return nil, err
	}

	lock, err := pgx.Connect(ctx, testURL)
	if err != nil {
		return nil, fmt.Errorf("connect to %s: %w", testDBName, err)
	}
	if _, err := lock.Exec(ctx, "SELECT pg_advisory_lock($1)", lockKey); err != nil {
		lock.Close(ctx)
		return nil, err
	}
	var name string
	if err := lock.QueryRow(ctx, "SELECT current_database()").Scan(&name); err != nil || !strings.HasSuffix(name, "_test") {
		lock.Close(ctx)
		return nil, fmt.Errorf("refusing to reset database %q: the name must end in _test", name)
	}
	if _, err := lock.Exec(ctx, "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS test_snapshot CASCADE; CREATE SCHEMA public;"); err != nil {
		lock.Close(ctx)
		return nil, err
	}
	if err := migrate(ctx, testURL); err != nil {
		lock.Close(ctx)
		return nil, err
	}
	snapshot := "CREATE SCHEMA test_snapshot;"
	for _, t := range migrationDataTables {
		snapshot += fmt.Sprintf(" CREATE TABLE test_snapshot.%s AS TABLE public.%s;", t, t)
	}
	if _, err := lock.Exec(ctx, snapshot); err != nil {
		lock.Close(ctx)
		return nil, err
	}

	pool, err := pgxpool.New(ctx, testURL)
	if err != nil {
		lock.Close(ctx)
		return nil, err
	}
	return &DB{Pool: pool, URL: testURL, lock: lock}, nil
}

// Close releases the pool and the lock (closing the connection frees it).
func (d *DB) Close() {
	d.Pool.Close()
	d.lock.Close(context.Background())
}

// Reset empties every table, restores the settings and delivery rows from
// the migrations, and (if withSeed) loads the sample catalogue. Each test
// calls it first, so tests never depend on each other.
func (d *DB) Reset(ctx context.Context, withSeed bool) error {
	sqlText := "TRUNCATE " + strings.Join(appTables, ", ") + " RESTART IDENTITY CASCADE;"
	for _, t := range migrationDataTables {
		sqlText += fmt.Sprintf(" INSERT INTO public.%s OVERRIDING SYSTEM VALUE SELECT * FROM test_snapshot.%s;", t, t)
	}
	// Identity counters must continue after the restored ids.
	sqlText += " SELECT setval(pg_get_serial_sequence('delivery_zones', 'id'), (SELECT max(id) FROM delivery_zones));"
	sqlText += " SELECT setval(pg_get_serial_sequence('delivery_areas', 'id'), (SELECT max(id) FROM delivery_areas));"
	if _, err := d.Pool.Exec(ctx, sqlText); err != nil {
		return err
	}
	if withSeed {
		if _, err := d.Pool.Exec(ctx, dbfiles.DevSeed); err != nil {
			return fmt.Errorf("dev seed: %w", err)
		}
	}
	return nil
}

func migrate(ctx context.Context, dsn string) error {
	sqlDB, err := sql.Open("pgx", dsn)
	if err != nil {
		return err
	}
	defer sqlDB.Close()
	migrations, err := fs.Sub(dbfiles.Migrations, "migrations")
	if err != nil {
		return err
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations)
	if err != nil {
		return err
	}
	_, err = provider.Up(ctx)
	return err
}

func createIfMissing(ctx context.Context, adminURL string) error {
	conn, err := pgx.Connect(ctx, adminURL)
	if err != nil {
		return fmt.Errorf("connect to the database server: %w", err)
	}
	defer conn.Close(ctx)
	var exists bool
	if err := conn.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)", testDBName).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = conn.Exec(ctx, "CREATE DATABASE "+testDBName)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "42P04" || pgErr.Code == "23505") {
		return nil // another test package created it a moment ago
	}
	return err
}

// withDatabase returns the same URL with a different database name.
func withDatabase(raw, name string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return "", errors.New("DATABASE_URL is not a valid URL")
	}
	u.Path = "/" + name
	return u.String(), nil
}

// findDotEnv loads the first .env found in this folder or a parent folder
// (tests run inside their package folder, e.g. api/internal/httpapi).
func findDotEnv() {
	dir, err := os.Getwd()
	if err != nil {
		return
	}
	for range 6 {
		if path, _ := config.LoadDotEnv(filepath.Join(dir, ".env")); path != "" {
			return
		}
		dir = filepath.Dir(dir)
	}
}
