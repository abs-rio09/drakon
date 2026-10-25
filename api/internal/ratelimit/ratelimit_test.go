package ratelimit

import (
	"sync"
	"testing"
	"time"
)

type clock struct{ t time.Time }

func (c *clock) now() time.Time { return c.t }

func newTest() (*Limiter, *clock) {
	c := &clock{t: time.Date(2026, 10, 25, 12, 0, 0, 0, time.UTC)}
	return New(c.now), c
}

func TestUnderAndOverTheLimit(t *testing.T) {
	l, c := newTest()
	for i := range 3 {
		if ok, _ := l.Allow("login|1.1.1.1", 3, time.Minute); !ok {
			t.Fatalf("try %d refused, limit is 3", i+1)
		}
	}
	c.t = c.t.Add(20 * time.Second)
	ok, wait := l.Allow("login|1.1.1.1", 3, time.Minute)
	if ok {
		t.Fatal("4th try allowed")
	}
	if wait != 40*time.Second {
		t.Fatalf("Retry-After %v, want 40s (the rest of the window)", wait)
	}
}

func TestWindowResets(t *testing.T) {
	l, c := newTest()
	l.Allow("k", 1, time.Minute)
	if ok, _ := l.Allow("k", 1, time.Minute); ok {
		t.Fatal("2nd try allowed")
	}
	c.t = c.t.Add(time.Minute)
	if ok, _ := l.Allow("k", 1, time.Minute); !ok {
		t.Fatal("refused after the window ended")
	}
}

func TestKeysAreSeparate(t *testing.T) {
	l, _ := newTest()
	l.Allow("login|1.1.1.1", 1, time.Minute)
	if ok, _ := l.Allow("login|2.2.2.2", 1, time.Minute); !ok {
		t.Fatal("another IP was refused")
	}
	if ok, _ := l.Allow("track|1.1.1.1", 1, time.Minute); !ok {
		t.Fatal("another action of the same IP was refused")
	}
}

// Refused tries are not counted: after the window the visitor starts fresh.
func TestRefusedTriesDoNotCount(t *testing.T) {
	l, c := newTest()
	for range 10 {
		l.Allow("k", 2, time.Minute)
	}
	c.t = c.t.Add(time.Minute)
	for i := range 2 {
		if ok, _ := l.Allow("k", 2, time.Minute); !ok {
			t.Fatalf("try %d refused in a new window", i+1)
		}
	}
}

func TestOldWindowsAreSwept(t *testing.T) {
	l, c := newTest()
	for _, k := range []string{"a", "b", "c"} {
		l.Allow(k, 5, time.Minute)
	}
	c.t = c.t.Add(2 * time.Minute)
	l.Allow("d", 5, time.Minute)
	if n := l.Len(); n != 1 {
		t.Fatalf("%d keys in memory after the sweep, want 1", n)
	}
}

// Many requests at the same moment: exactly max get through.
func TestParallel(t *testing.T) {
	l, _ := newTest()
	var wg sync.WaitGroup
	var mu sync.Mutex
	allowed := 0
	for range 100 {
		wg.Go(func() {
			if ok, _ := l.Allow("k", 10, time.Minute); ok {
				mu.Lock()
				allowed++
				mu.Unlock()
			}
		})
	}
	wg.Wait()
	if allowed != 10 {
		t.Fatalf("%d allowed, want 10", allowed)
	}
}
