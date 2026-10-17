package main

import (
	"os"
	"path/filepath"
	"testing"

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
