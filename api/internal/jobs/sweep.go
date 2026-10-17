// Package jobs runs the background sweep (docs/blueprint.md, part 4):
//   - PENDING orders not confirmed within cod_confirm_hours are cancelled
//     and their stock goes back
//   - SOLD_OUT products older than archive_after_days move to ARCHIVED
//   - dead admin sessions (expired or idle too long) are deleted
//
// The free Render server sleeps when nobody visits, so instead of a fixed
// clock time the sweep runs when the server starts and then every 10
// minutes while it is awake. Running it twice changes nothing the second
// time (idempotent), so overlapping runs are harmless.
package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abs-rio09/drakon/api/internal/auth"
	"github.com/abs-rio09/drakon/api/internal/db"
	"github.com/abs-rio09/drakon/api/internal/orders"
	"github.com/abs-rio09/drakon/api/internal/settings"
)

// Interval between sweeps while the server is awake.
const Interval = 10 * time.Minute

type Sweeper struct {
	pool *pgxpool.Pool
	log  *slog.Logger
	// Now returns the current time. Tests set a fixed clock.
	Now func() time.Time
}

func NewSweeper(pool *pgxpool.Pool, logger *slog.Logger) *Sweeper {
	return &Sweeper{pool: pool, log: logger, Now: time.Now}
}

// Result says what one sweep changed.
type Result struct {
	Cancelled       int // orders auto-cancelled
	Archived        int // products moved to ARCHIVED
	SessionsRemoved int // dead admin sessions deleted
}

// RunOnce does one full sweep.
func (s *Sweeper) RunOnce(ctx context.Context) (Result, error) {
	var res Result
	now := s.Now()
	q := db.New(s.pool)
	set, err := settings.Load(ctx, q)
	if err != nil {
		return res, err
	}

	// 1. Auto-cancel. Each order gets its own small transaction, so one
	//    problem order does not block the others.
	cutoff := now.Add(-time.Duration(set.CodConfirmHours) * time.Hour)
	ids, err := q.ListExpiredPendingOrders(ctx, cutoff)
	if err != nil {
		return res, err
	}
	reason := fmt.Sprintf("Not confirmed by phone within %d hours", set.CodConfirmHours)
	onlyPending := func(st db.OrderStatus) bool { return st == db.OrderStatusPENDING }
	for _, id := range ids {
		var cancelled bool
		err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
			// CancelLocked locks the row and checks again that it is still
			// PENDING (the admin may have confirmed it a second ago).
			var err error
			cancelled, err = orders.CancelLocked(ctx, q.WithTx(tx), id, onlyPending, db.ActorTypeSYSTEM, nil, reason, now)
			return err
		})
		if err != nil {
			return res, fmt.Errorf("auto-cancel order %d: %w", id, err)
		}
		if cancelled {
			res.Cancelled++
		}
	}

	// 2. Auto-archive, in one transaction with its product_events rows.
	archiveCutoff := now.Add(-time.Duration(set.ArchiveAfterDays) * 24 * time.Hour)
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		qtx := q.WithTx(tx)
		archived, err := qtx.ArchiveOldSoldOut(ctx, db.ArchiveOldSoldOutParams{Cutoff: &archiveCutoff, At: &now})
		if err != nil {
			return err
		}
		old, next := string(db.ProductStatusSOLDOUT), string(db.ProductStatusARCHIVED)
		for _, productID := range archived {
			if err := qtx.InsertProductEvent(ctx, db.InsertProductEventParams{
				ProductID: productID, Type: db.ProductEventTypeARCHIVE, Actor: db.ActorTypeSYSTEM,
				Reason:   fmt.Sprintf("Sold out for more than %d days", set.ArchiveAfterDays),
				OldValue: &old, NewValue: &next, At: now,
			}); err != nil {
				return err
			}
		}
		res.Archived = len(archived)
		return nil
	})
	if err != nil {
		return res, err
	}

	// 3. Housekeeping: admin sessions that can never be used again.
	removed, err := q.DeleteDeadAdminSessions(ctx, db.DeleteDeadAdminSessionsParams{
		Now: now, IdleCutoff: now.Add(-auth.SessionIdle),
	})
	res.SessionsRemoved = int(removed)
	return res, err
}

// Start runs a sweep now and then every interval, until ctx is cancelled.
// Call wg.Wait() after cancelling to let a running sweep finish.
func (s *Sweeper) Start(ctx context.Context, interval time.Duration, wg *sync.WaitGroup) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			s.runAndLog(ctx)
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func (s *Sweeper) runAndLog(ctx context.Context) {
	res, err := s.RunOnce(ctx)
	if err != nil {
		if ctx.Err() == nil {
			s.log.Error("sweep failed", "err", err)
		}
		return
	}
	if res.Cancelled > 0 || res.Archived > 0 || res.SessionsRemoved > 0 {
		s.log.Info("sweep", "auto_cancelled", res.Cancelled, "archived", res.Archived, "sessions_removed", res.SessionsRemoved)
	}
}
