package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	dbfiles "github.com/abs-rio09/drakon/api/db"
)

// resetTables are emptied by reset-dev: every order and everything around
// it, and the catalogue (the seed loads it again). Kept: admins and their
// sessions, settings, delivery zones and areas (the Owner may have changed
// them; they come from the migrations, not from the seed).
// No CASCADE: if a new table points at one of these, the TRUNCATE fails
// instead of quietly emptying a table that is not in this list.
var resetTables = []string{
	"return_items", "returns", "payments", "order_status_history", "order_items", "orders",
	"blocked_phones", "inventory_movements", "product_events",
	"product_variants", "product_images", "product_details", "products", "categories",
}

// resetTarget checks that dbURL is a database on this computer and returns
// its name. Anything else (Neon, another server, an unreadable URL) is
// refused, so reset-dev can never wipe production.
func resetTarget(dbURL string) (string, error) {
	if !isLocalDB(dbURL) {
		return "", errors.New("reset-dev works only with a database on this computer (localhost); nothing was changed")
	}
	u, _ := url.Parse(dbURL)
	name := strings.TrimPrefix(u.Path, "/")
	if name == "" || strings.Contains(name, "/") {
		return "", errors.New("DATABASE_URL has no database name; nothing was changed")
	}
	return name, nil
}

// confirmed reads one line and accepts only "reset <database name>",
// exactly (spaces around it are fine).
func confirmed(in io.Reader, name string) bool {
	line, err := bufio.NewReader(in).ReadString('\n')
	if err != nil && line == "" {
		return false
	}
	return strings.TrimSpace(line) == "reset "+name
}

// resetScript puts the TRUNCATE inside the seed's own BEGIN ... COMMIT,
// so emptying and refilling is one transaction: if the seed fails, the
// TRUNCATE is undone too.
func resetScript(seed string) (string, error) {
	const begin = "\nBEGIN;\n"
	if strings.Count(seed, begin) != 1 || !strings.Contains(seed, "\nCOMMIT;") {
		return "", errors.New("the seed file must have exactly one BEGIN; ... COMMIT; block")
	}
	truncate := "TRUNCATE " + strings.Join(resetTables, ", ") + " RESTART IDENTITY;\n"
	return strings.Replace(seed, begin, begin+truncate, 1), nil
}

// resetDev empties the orders and the catalogue of the local dev database
// and loads the sample catalogue again, in one transaction (all or
// nothing, see resetScript). The admin account stays, so you can log in right after.
func resetDev(ctx context.Context, pool *pgxpool.Pool, dbURL string, in io.Reader) error {
	name, err := resetTarget(dbURL)
	if err != nil {
		return err
	}
	fmt.Printf("This deletes EVERY order, return and product in the database %q and loads the sample catalogue again.\n", name)
	fmt.Println("Kept: the admin account, settings, delivery zones and areas.")
	fmt.Printf("Type   reset %s   and press Enter to go on (anything else stops): ", name)
	if !confirmed(in, name) {
		return errors.New("not confirmed; nothing was changed")
	}

	script, err := resetScript(dbfiles.DevSeed)
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, script); err != nil {
		return fmt.Errorf("reset (nothing was changed): %w", err)
	}
	fmt.Println("Done: no orders, the sample catalogue is back. Your admin login still works.")
	return nil
}
