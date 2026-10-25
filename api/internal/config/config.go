// Package config reads the server settings from environment variables.
// Secrets (the database password) are never written in code: they come from
// the environment, or from the gitignored .env file during local development.
package config

import (
	"bufio"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
)

// DevOrigin is the Vite dev server: the only allowed origin when
// ALLOWED_ORIGINS is not set.
const DevOrigin = "http://localhost:5173"

type Config struct {
	DatabaseURL string // postgres://user:password@host:5432/db?sslmode=disable
	Port        string // 8080 if not set
	// CookieSecure puts "Secure" on the admin cookie (sent over HTTPS only).
	// Keep it true. Browsers make an exception for http://localhost, so it
	// works in dev too. COOKIE_SECURE=false only for testing from another
	// device on plain http (e.g. your phone on http://192.168.x.x:5173).
	CookieSecure bool
	// AllowedOrigins: the websites allowed to send admin changes (CSRF
	// guard). ALLOWED_ORIGINS="https://a.example,https://b.example".
	AllowedOrigins []string
	// TrustedProxy says which proxy in front of the API may tell us the
	// visitor's IP address (for the per-IP rate limits). "" = nobody: the
	// direct connection address is used, and forwarded-IP headers are
	// ignored, because any visitor can type them. "cloudflare" = our Worker
	// (web/worker/index.ts), proven by ProxySecret on every request.
	TrustedProxy string
	// ProxySecret is shared by the Worker and the API (TRUSTED_PROXY=cloudflare
	// only). A request that does not carry it is treated like a direct one.
	ProxySecret string
}

// TrustedProxyCloudflare is the only proxy we know today.
const TrustedProxyCloudflare = "cloudflare"

// minProxySecret is the shortest PROXY_SECRET we accept (openssl rand -hex 32
// gives 64 characters).
const minProxySecret = 32

// Load reads the config. Call LoadDotEnv first in local development.
func Load() (Config, error) {
	cfg := Config{
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		Port:         os.Getenv("PORT"),
		CookieSecure: true,
	}
	if cfg.Port == "" {
		cfg.Port = "8080"
	}
	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is not set (add it to .env, see .env.example)")
	}
	switch strings.ToLower(strings.TrimSpace(os.Getenv("COOKIE_SECURE"))) {
	case "", "true", "1", "yes":
	case "false", "0", "no":
		cfg.CookieSecure = false
	default:
		return cfg, errors.New("COOKIE_SECURE must be true or false")
	}
	origins, err := ParseOrigins(os.Getenv("ALLOWED_ORIGINS"))
	if err != nil {
		return cfg, err
	}
	cfg.AllowedOrigins = origins
	switch proxy := strings.ToLower(strings.TrimSpace(os.Getenv("TRUSTED_PROXY"))); proxy {
	case "":
	case TrustedProxyCloudflare:
		cfg.TrustedProxy = proxy
		cfg.ProxySecret = strings.TrimSpace(os.Getenv("PROXY_SECRET"))
		if len(cfg.ProxySecret) < minProxySecret {
			return cfg, fmt.Errorf("TRUSTED_PROXY=cloudflare needs PROXY_SECRET (at least %d characters, the same as the Worker's secret)", minProxySecret)
		}
	default:
		return cfg, errors.New(`TRUSTED_PROXY must be empty or "cloudflare"`)
	}
	return cfg, nil
}

// ParseOrigins reads a comma-separated list like
// "https://drakon.example.workers.dev,http://localhost:5173".
// Each origin is scheme://host[:port], without a path or a trailing slash,
// exactly as browsers send it in the Origin header. Empty = DevOrigin.
func ParseOrigins(raw string) ([]string, error) {
	out := []string{}
	for _, part := range strings.Split(raw, ",") {
		o := strings.TrimSpace(part)
		if o == "" {
			continue
		}
		u, err := url.Parse(o)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" ||
			u.Path != "" || u.RawQuery != "" || u.User != nil {
			return nil, fmt.Errorf("ALLOWED_ORIGINS: %q is not an origin like https://example.com (no path, no trailing slash)", o)
		}
		out = append(out, o)
	}
	if len(out) == 0 {
		out = []string{DevOrigin}
	}
	return out, nil
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
