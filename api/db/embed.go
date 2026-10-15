// Package dbfiles gives Go code access to the SQL files in this folder.
// Tests use it to build the drakon_test database from the same migrations
// and seed that you run by hand.
package dbfiles

import "embed"

// Migrations holds the goose files: fs.Sub(Migrations, "migrations").
//
//go:embed migrations/*.sql
var Migrations embed.FS

// DevSeed is the sample catalogue (db/seed/dev_seed.sql).
//
//go:embed seed/dev_seed.sql
var DevSeed string
