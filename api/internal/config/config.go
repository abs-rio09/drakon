// Package config reads the server settings from environment variables.
// Secrets (the database password) are never written in code: they come from
// the environment, or from the gitignored .env file during local development.
package config

import (
	"bufio"
	"errors"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string // postgres://user:password@host:5432/db?sslmode=disable
	Port        string // 8080 if not set
}

// Load reads the config. Call LoadDotEnv first in local development.
func Load() (Config, error) {
	cfg := Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        os.Getenv("PORT"),
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is not set (add it to .env, see .env.example)")
	}
	return cfg, nil
}

// LoadDotEnv reads KEY=value lines from the first file in paths that exists
// and puts them into the environment. Real environment variables win: a key
// that is already set is left alone. Lines starting with # are comments.
// It returns the file it read, or "" when none was found.
func LoadDotEnv(paths ...string) (string, error) {
	for _, path := range paths {
		f, err := os.Open(path)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return "", err
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
			value = strings.Trim(strings.TrimSpace(value), `"'`)
			if _, set := os.LookupEnv(key); !set {
				os.Setenv(key, value)
			}
		}
		return path, scanner.Err()
	}
	return "", nil
}
