package main

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	dbfiles "github.com/abs-rio09/drakon/api/db"
	"github.com/abs-rio09/drakon/api/internal/auth"
)

func TestSetEnvValuesReplacesAndAppends(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	start := "# comment\nPORT=8080\nDEV_ADMIN_EMAIL=old@drakon.local\n"
	if err := os.WriteFile(path, []byte(start), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := setEnvValues(path, [][2]string{{"DEV_ADMIN_EMAIL", "new@drakon.local"}, {"DEV_ADMIN_PASSWORD", "secret-value"}}); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(path)
	want := "# comment\nPORT=8080\nDEV_ADMIN_EMAIL=new@drakon.local\nDEV_ADMIN_PASSWORD=secret-value\n"
	if string(got) != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v, want 0600 kept", info.Mode().Perm())
	}
}

func TestDevOwnerOnlyForLocalDatabases(t *testing.T) {
	for url, want := range map[string]bool{
		"postgres://drakon:x@localhost:5432/drakon":                        true,
		"postgres://drakon:x@127.0.0.1/drakon":                             true,
		"postgres://u:x@ep-cool-name.aws.neon.tech/drakon?sslmode=require": false,
		"not a url": false,
	} {
		if got := isLocalDB(url); got != want {
			t.Errorf("isLocalDB(%q) = %v", url, got)
		}
	}
}

func TestRandomPasswordIsStrong(t *testing.T) {
	a, b := randomPassword(), randomPassword()
	if a == b || auth.CheckNewPassword(a, defaultDevEmail) != "" {
		t.Fatalf("passwords %q %q", a, b)
	}
}

func TestCheckNewPassword(t *testing.T) {
	for pw, ok := range map[string]bool{
		"short":                  false,
		"twelve chars":           true,
		" starts with a space":   false,
		"owner@drakon.local":     false, // the email itself
		string(make([]byte, 73)): false, // over bcrypt's 72 bytes
		"এটা বাংলা পাসওয়ার্ড ভালো": true,
	} {
		if got := auth.CheckNewPassword(pw, "owner@drakon.local") == ""; got != ok {
			t.Errorf("%q: ok = %v, want %v", pw, got, ok)
		}
	}
}

func TestResetDevRefusesNonLocalDatabases(t *testing.T) {
	for _, url := range []string{
		"postgres://u:x@ep-cool-name.aws.neon.tech/drakon?sslmode=require",
		"postgres://u:x@db.example.com:5432/drakon",
		"postgres://u:x@localhost.example.com/drakon", // looks local, is not
		"not a url",
		"postgres://u:x@localhost:5432/", // no database name
	} {
		if _, err := resetTarget(url); err == nil {
			t.Errorf("resetTarget(%q) accepted", url)
		}
	}
	if name, err := resetTarget("postgres://u:x@localhost:5432/drakon?sslmode=disable"); err != nil || name != "drakon" {
		t.Fatalf("local: %q %v", name, err)
	}
	// Refused before it reads anything or touches a database (pool is nil).
	err := resetDev(context.Background(), nil, "postgres://u:x@ep-x.neon.tech/drakon", strings.NewReader("reset drakon\n"))
	if err == nil || !strings.Contains(err.Error(), "localhost") {
		t.Fatalf("neon: %v", err)
	}
}

func TestResetDevNeedsTheExactWords(t *testing.T) {
	for input, ok := range map[string]bool{
		"reset drakon\n":     true,
		"  reset drakon  \n": true,
		"reset drakon":       true, // Enter missing at the end of the input
		"":                   false,
		"\n":                 false,
		"yes\n":              false,
		"reset\n":            false,
		"Reset drakon\n":     false,
		"reset drakon_ui\n":  false,
		"reset  drakon\n":    false,
	} {
		if got := confirmed(strings.NewReader(input), "drakon"); got != ok {
			t.Errorf("%q: %v, want %v", input, got, ok)
		}
	}
	// Not confirmed: stops before the database is used (pool is nil).
	err := resetDev(context.Background(), nil, "postgres://u:x@localhost/drakon", strings.NewReader("yes\n"))
	if err == nil || !strings.Contains(err.Error(), "nothing was changed") {
		t.Fatalf("not confirmed: %v", err)
	}
}

func TestResetScriptIsOneTransaction(t *testing.T) {
	script, err := resetScript(dbfiles.DevSeed)
	if err != nil {
		t.Fatal(err)
	}
	b := strings.Index(script, "\nBEGIN;\n")
	tr := strings.Index(script, "TRUNCATE ")
	c := strings.LastIndex(script, "\nCOMMIT;")
	if b < 0 || !(b < tr && tr < c) {
		t.Fatalf("TRUNCATE must sit between BEGIN and COMMIT: %d %d %d", b, tr, c)
	}
	for _, kept := range []string{"admins", "admin_sessions", "settings", "delivery_zones", "delivery_areas"} {
		if slices.Contains(resetTables, kept) {
			t.Errorf("%s must be kept", kept)
		}
	}
	if _, err := resetScript("INSERT 1;"); err == nil {
		t.Error("a seed without BEGIN/COMMIT was accepted")
	}
}
