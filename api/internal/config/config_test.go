package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvRealEnvWins(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	content := "# comment\nDRAKON_TEST_A=from-file\nDRAKON_TEST_B=\"quoted\"\n\nexport DRAKON_TEST_C=c\nnot a pair\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DRAKON_TEST_A", "from-env")
	// t.Setenv registers cleanup; unset B and C after the test too.
	t.Setenv("DRAKON_TEST_B", "")
	os.Unsetenv("DRAKON_TEST_B")
	t.Setenv("DRAKON_TEST_C", "")
	os.Unsetenv("DRAKON_TEST_C")

	got, err := LoadDotEnv(filepath.Join(dir, "missing"), path)
	if err != nil || got != path {
		t.Fatalf("LoadDotEnv = %q, %v", got, err)
	}
	if v := os.Getenv("DRAKON_TEST_A"); v != "from-env" {
		t.Errorf("A = %q, want the real env value", v)
	}
	if v := os.Getenv("DRAKON_TEST_B"); v != "quoted" {
		t.Errorf("B = %q, want quotes removed", v)
	}
	if v := os.Getenv("DRAKON_TEST_C"); v != "c" {
		t.Errorf("C = %q, want export prefix handled", v)
	}
}

func TestLoadDefaultsPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("PORT", "")
	cfg, err := Load()
	if err != nil || cfg.Port != "8080" {
		t.Fatalf("Load = %+v, %v", cfg, err)
	}
	t.Setenv("DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("want an error without DATABASE_URL")
	}
}

func TestLoadSecurityDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("COOKIE_SECURE", "")
	t.Setenv("ALLOWED_ORIGINS", "")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.CookieSecure || len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != DevOrigin {
		t.Fatalf("defaults = %+v", cfg)
	}
	t.Setenv("COOKIE_SECURE", "false")
	t.Setenv("ALLOWED_ORIGINS", "https://drakon.example.workers.dev, http://localhost:5173")
	cfg, err = Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.CookieSecure || len(cfg.AllowedOrigins) != 2 || cfg.AllowedOrigins[0] != "https://drakon.example.workers.dev" {
		t.Fatalf("custom = %+v", cfg)
	}
	t.Setenv("COOKIE_SECURE", "maybe")
	if _, err := Load(); err == nil {
		t.Fatal("COOKIE_SECURE=maybe was accepted")
	}
}

func TestParseOriginsRefusesPaths(t *testing.T) {
	for _, bad := range []string{"https://x.com/", "https://x.com/admin", "x.com", "ftp://x.com", "https://user@x.com"} {
		if _, err := ParseOrigins(bad); err == nil {
			t.Errorf("%q was accepted", bad)
		}
	}
}

func TestLoadTrustedProxy(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("TRUSTED_PROXY", "")
	t.Setenv("PROXY_SECRET", "")
	cfg, err := Load()
	if err != nil || cfg.TrustedProxy != "" {
		t.Fatalf("default: %q, %v (want nobody trusted)", cfg.TrustedProxy, err)
	}

	t.Setenv("TRUSTED_PROXY", "cloudflare")
	if _, err := Load(); err == nil {
		t.Fatal("cloudflare without PROXY_SECRET was accepted")
	}
	t.Setenv("PROXY_SECRET", "too-short")
	if _, err := Load(); err == nil {
		t.Fatal("a short PROXY_SECRET was accepted")
	}
	t.Setenv("PROXY_SECRET", "0123456789abcdef0123456789abcdef")
	cfg, err = Load()
	if err != nil || cfg.TrustedProxy != TrustedProxyCloudflare || cfg.ProxySecret == "" {
		t.Fatalf("cloudflare: %q, %v", cfg.TrustedProxy, err)
	}

	t.Setenv("TRUSTED_PROXY", "everyone")
	if _, err := Load(); err == nil {
		t.Fatal("an unknown TRUSTED_PROXY was accepted")
	}
}
