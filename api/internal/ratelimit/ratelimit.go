// Package ratelimit counts requests per key (for example "login|1.2.3.4")
// in fixed time windows, in memory. Standard library only.
//
// Memory is enough while the API runs as one process (one Render
// instance): every request passes this one map. With several instances
// each would count on its own, so a visitor could get N times the limit;
// then the counts must move to a shared store (PostgreSQL or Redis).
// A restart forgets every count, which is harmless.
package ratelimit

import (
	"sync"
	"time"
)

// sweepEvery is how often finished windows are removed from the map, so
// it cannot grow forever with one entry per visitor ever seen.
const sweepEvery = time.Minute

type window struct {
	end   time.Time
	count int
}

type Limiter struct {
	mu        sync.Mutex
	windows   map[string]*window
	lastSweep time.Time
	now       func() time.Time
}

// New returns an empty limiter. now is the clock (time.Now; tests pass a
// fake one).
func New(now func() time.Time) *Limiter {
	return &Limiter{windows: map[string]*window{}, now: now, lastSweep: now()}
}

// Allow counts one request for key. A key may make max requests per
// window of length per. Over the limit it returns false and how long
// until the window ends (for the Retry-After header). A refused request
// is not counted, so waiting always helps.
func (l *Limiter) Allow(key string, max int, per time.Duration) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if now.Sub(l.lastSweep) >= sweepEvery {
		for k, w := range l.windows {
			if !now.Before(w.end) {
				delete(l.windows, k)
			}
		}
		l.lastSweep = now
	}

	w, ok := l.windows[key]
	if !ok || !now.Before(w.end) {
		w = &window{end: now.Add(per)}
		l.windows[key] = w
	}
	if w.count >= max {
		return false, w.end.Sub(now)
	}
	w.count++
	return true, 0
}

// Len is the number of keys in memory (for tests).
func (l *Limiter) Len() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.windows)
}
