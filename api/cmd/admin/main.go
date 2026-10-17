// The DRAKON admin tool: makes the Owner account and changes its password.
// It works against any database in DATABASE_URL (your PC or Neon later).
//
//	go run ./cmd/admin create-owner --email you@example.com
//	go run ./cmd/admin reset-password --email you@example.com
//	go run ./cmd/admin dev-owner          (your PC only, see below)
//
// Passwords are typed hidden (nothing shows on the screen) and asked twice.
// They are never printed and never written to a log.
package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/term"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/config"
)

const usage = `DRAKON admin tool

  create-owner --email <email>    make the one Owner account (password typed hidden, twice)
  reset-password --email <email>  new password, ends the lockout, logs out every browser
  dev-owner                       LOCAL ONLY: owner with a random password, saved in .env

Uses DATABASE_URL from the environment or from .env.
`

// defaultDevEmail is used by dev-owner when .env has no DEV_ADMIN_EMAIL.
const defaultDevEmail = "owner@drakon.local"

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		fmt.Print(usage)
		return errors.New("choose a command")
	}
	envFile, err := config.LoadDotEnv(".env", "../.env")
	if err != nil {
		return err
	}
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return errors.New("DATABASE_URL is not set (add it to .env, see .env.example)")
	}

	cmd, rest := args[0], args[1:]
	fs := flag.NewFlagSet(cmd, flag.ContinueOnError)
	email := fs.String("email", "", "the admin's email")
	if err := fs.Parse(rest); err != nil {
		return err
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	fmt.Println("Database:", describeDB(dbURL))

	switch cmd {
	case "create-owner", "reset-password":
		e := auth.NormalizeEmail(*email)
		if problem := auth.CheckEmail(e); problem != "" {
			return fmt.Errorf("--email: %s", problem)
		}
		password, err := askPassword(e)
		if err != nil {
			return err
		}
		if cmd == "create-owner" {
			if _, err := auth.CreateOwner(ctx, pool, e, password, time.Now()); err != nil {
				return err
			}
			fmt.Println("Owner created:", e)
			return nil
		}
		if err := auth.SetPassword(ctx, pool, e, password, time.Now()); err != nil {
			return err
		}
		fmt.Println("Password changed for", e, "(every browser of this admin is logged out)")
		return nil
	case "dev-owner":
		return devOwner(ctx, pool, dbURL, envFile)
	default:
		fmt.Print(usage)
		return fmt.Errorf("unknown command %q", cmd)
	}
}

// askPassword reads the new password twice without showing it.
func askPassword(email string) (string, error) {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return "", errors.New("run this in a terminal: the password must be typed, not piped")
	}
	fmt.Printf("New password (at least %d characters, nothing shows while you type): ", auth.MinPasswordRunes)
	first, err := term.ReadPassword(fd)
	fmt.Println()
	if err != nil {
		return "", err
	}
	if problem := auth.CheckNewPassword(string(first), email); problem != "" {
		return "", errors.New(problem)
	}
	fmt.Print("Type it again: ")
	second, err := term.ReadPassword(fd)
	fmt.Println()
	if err != nil {
		return "", err
	}
	if string(first) != string(second) {
		return "", errors.New("the two passwords are not the same; nothing was changed")
	}
	return string(first), nil
}

// devOwner is for your own PC: it makes (or resets) a dev Owner with a
// random password and saves both into the gitignored .env file as
// DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD. It refuses any database that is
// not on this computer, so it can never touch production.
func devOwner(ctx context.Context, pool *pgxpool.Pool, dbURL, envFile string) error {
	if !isLocalDB(dbURL) {
		return errors.New("dev-owner works only with a database on this computer (localhost); use create-owner instead")
	}
	if envFile == "" {
		return errors.New("no .env file found (run from api/ or the repo root, see .env.example)")
	}
	email := auth.NormalizeEmail(os.Getenv("DEV_ADMIN_EMAIL"))
	if email == "" {
		email = defaultDevEmail
	}
	password := randomPassword()

	_, err := auth.CreateOwner(ctx, pool, email, password, time.Now())
	action := "created"
	if errors.Is(err, auth.ErrOwnerExists) {
		err = auth.SetPassword(ctx, pool, email, password, time.Now())
		action = "given a new password"
		if errors.Is(err, auth.ErrNoSuchAdmin) {
			return fmt.Errorf("an owner with another email already exists; set DEV_ADMIN_EMAIL in .env to that email, or use reset-password")
		}
	}
	if err != nil {
		return err
	}
	if err := setEnvValues(envFile, [][2]string{{"DEV_ADMIN_EMAIL", email}, {"DEV_ADMIN_PASSWORD", password}}); err != nil {
		return fmt.Errorf("the owner was %s, but saving .env failed: %w (run dev-owner again)", action, err)
	}
	abs, _ := filepath.Abs(envFile)
	fmt.Printf("Dev owner %s was %s.\nThe password is in %s (line DEV_ADMIN_PASSWORD). It is not shown here on purpose.\n", email, action, abs)
	return nil
}

// randomPassword: 18 random bytes = 24 characters, far over the minimum.
func randomPassword() string {
	b := make([]byte, 18)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func isLocalDB(dbURL string) bool {
	u, err := url.Parse(dbURL)
	if err != nil {
		return false
	}
	switch u.Hostname() {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}

// describeDB shows where we connect, without the password.
func describeDB(dbURL string) string {
	u, err := url.Parse(dbURL)
	if err != nil {
		return "(unreadable DATABASE_URL)"
	}
	return u.Hostname() + u.Path
}

// setEnvValues replaces KEY=... lines in the .env file (or adds them at the
// end), keeping every other line as it is. It writes a new file next to it
// and renames it over the old one, so a crash never leaves half a file.
func setEnvValues(path string, values [][2]string) error {
	old, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	lines := strings.Split(strings.TrimRight(string(old), "\n"), "\n")
	for _, kv := range values {
		line := kv[0] + "=" + kv[1]
		found := false
		for i, l := range lines {
			key, _, ok := strings.Cut(strings.TrimSpace(l), "=")
			if ok && strings.TrimSpace(strings.TrimPrefix(key, "export ")) == kv[0] {
				lines[i] = line
				found = true
			}
		}
		if !found {
			lines = append(lines, line)
		}
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(strings.Join(lines, "\n")+"\n"), info.Mode().Perm()); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
