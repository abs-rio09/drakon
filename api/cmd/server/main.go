// The DRAKON API server.
// Run from the api/ folder: go run ./cmd/server   (or: make run)
package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/config"
	"github.com/abs-rio09/drakon/api/internal/httpapi"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	// Local development: read .env from api/ or the repo root.
	// In production the host sets real environment variables instead.
	envFile, err := config.LoadDotEnv(".env", "../.env")
	if err != nil {
		return err
	}
	if envFile != "" {
		logger.Info("loaded env file", "path", envFile)
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// ctx is cancelled when you press Ctrl+C (SIGINT) or the host stops the
	// server (SIGTERM). That starts the graceful shutdown below.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		return errors.New("cannot reach the database (is it running? docker compose up -d db): " + err.Error())
	}

	api := httpapi.NewServer(pool, logger)

	srv := &http.Server{
		Addr:    net.JoinHostPort("", cfg.Port),
		Handler: api.Handler(),
		// Timeouts stop slow or stuck clients from holding connections forever.
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		logger.Info("api listening", "addr", "http://localhost:"+cfg.Port)
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	// Graceful shutdown: stop taking new requests, let running ones finish
	// (up to 10 seconds), then close the database pool.
	logger.Info("shutting down")
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	logger.Info("bye")
	return nil
}
