# Overnight run 2026-10-18: the Admin panel

Written for Abu Bakkar Siddik, in simple English. Nothing in this run was pushed to GitHub.

## Plan

- [x] 0. Start: read the docs, clean git, database up, all checks pass
- [x] 1. Admin accounts and login (API)
- [x] 2. Admin shell (web)
- [ ] 3. Orders admin (API + web)
- [ ] 4. Products admin (API + web)
- [ ] 5. Categories, settings and delivery admin
- [ ] 6. Returns
- [ ] 7. Deploy-ready files (prepare only, deploy nothing)
- [ ] 8. Final review pass

---

## Phase 0: start

- Read CLAUDE.md, docs/blueprint.md (parts 2, 5, 8, 9, 10), docs/open-questions.md, docs/api.md and the decisions of the 2026-10-16 log.
- `git status`: clean, `main` is 27 commits ahead of GitHub (on purpose, not pushed).
- `make db-up`: database container healthy. `make migrate-status`: 3 migrations applied (00001–00003).
- `make check`: gofmt clean, go vet clean, all tests pass.
- Task list: the checkboxes above are my task list for tonight (this tool has no separate to-do list).

---

## Phase 1: admin accounts and login (API)

### What I built
- **Migration `00004_admin.sql`**:
  - `admins` (email unique and lower-case, `password_hash`, `role` enum with only `OWNER`, `failed_attempts`, `locked_until`, `created_at`, `updated_at`). A unique index allows **only one OWNER** (blueprint rule 8).
  - `admin_sessions` (`id_hash`, `admin_id`, `created_at`, `last_seen_at`, `expires_at`).
  - The foreign key `product_events.by_admin_id → admins`.
  - `by_admin_id` on `order_status_history` (the database refuses an `ADMIN` row without it) and on `inventory_movements`, so every admin change keeps the admin's id.
  - Two new settings: `login_max_failures = 5`, `login_lockout_minutes = 15`.
- **`api/internal/auth`**: bcrypt (cost 12), login with lockout, sessions, logout, create owner, set password.
- **Endpoints**: `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`.
- **Middleware** for every `/api/admin` path: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and the Origin check (CSRF). Then a session check for every route except login.
- **Route table** `api/internal/httpapi/admin_routes.go`: every admin route is registered from one list.
- **Config**: `COOKIE_SECURE` (default true) and `ALLOWED_ORIGINS` (default `http://localhost:5173`).
- **Sweep**: also deletes dead sessions (expired or idle too long).
- **`cmd/admin`** tool:
  - `create-owner --email <email>`: password typed hidden (x/term), at least 12 characters, asked twice. Works with any `DATABASE_URL` (Neon later).
  - `reset-password --email <email>`: new password, ends the lockout, logs out every browser.
  - `dev-owner`: **local database only** (it refuses anything that is not localhost). Makes the Owner `owner@drakon.local` with a random password and saves `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` in the repo-root `.env` (gitignored). I ran it once: **your dev password is in `~/Desktop/projects/Drakon/drakon/.env`, line `DEV_ADMIN_PASSWORD`**. I never printed it.
  - Make targets: `make dev-owner`, `make create-owner EMAIL=you@example.com`, `make reset-password EMAIL=...`.
- **Tests** (all pass): login works (cookie flags, only the hash stored), wrong password and unknown email give exactly the same answer and both take bcrypt time, lockout after 5 failures, still locked at 14 minutes even with the right password, open again after 15, the numbers come from `settings`, 12 h idle → 401, 7 days max → 401, logout kills the session (a copied old cookie stops working), bad/missing Origin → 403, only one Owner, password reset logs out, `.env` writer, dev-owner refuses a non-local database, and **the table test**: every admin route answers 401 without a session (and with a made-up cookie). That test also fails if a route is added to `admin_routes.go` but not to the test.

### Why
Nobody could confirm or ship orders. The admin is the most powerful account on the site, so it must be safe before we build anything on top of it.

### Key concepts (for a beginner)
- **Password hash (bcrypt)**: we never store the password. bcrypt turns it into a hash like `$2a$12$...`. At login we hash what you typed and compare. "Cost 12" means bcrypt is slow on purpose (~0.2 s): fine for you, very slow for someone guessing millions of passwords.
- **Session**: after a good login the server makes a random secret (32 random bytes) and gives it to your browser in a **cookie**. The browser sends the cookie back with every admin request, so the server knows it is you. The database stores only the **SHA-256 hash** of the secret: if someone steals a copy of the database, they still cannot log in.
- **Cookie flags**:
  - `HttpOnly`: JavaScript cannot read the cookie, so even a bad script on the page cannot steal it.
  - `Secure`: the browser sends it only over HTTPS. Browsers make an exception for `http://localhost`, so it works in dev too (I checked with curl).
  - `SameSite=Lax`: the browser does not attach it to requests that other websites start in the background.
  - `Path=/api/admin`: it is sent only to admin API calls.
- **Expiry**: a session ends after 12 hours without use, and after 7 days at the latest. Logout deletes the row, so the cookie becomes useless.
- **Lockout**: after 5 wrong passwords in a row, login pauses for 15 minutes (both numbers in `settings`). During the pause even the right password is refused.
- **Same answer for wrong email and wrong password**: otherwise an attacker could learn which emails have an account. For an unknown email we still run one bcrypt check against a dummy hash, so the time is about the same too.
- **CSRF (cross-site request forgery)**: a bad website could try to make *your* browser send "cancel this order" to our API, and the browser would attach your cookie. Defence: every request that changes something must have an `Origin` header (the browser fills it in, a website cannot fake it) that is on our allowed list. Otherwise 403.
- **no-store**: tells the browser and any proxy not to keep a copy of admin answers.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make migrate          # applies 00004_admin.sql (already done on your PC)
make check            # all tests
make run              # terminal 1
```
Terminal 2:
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
curl -s localhost:8080/api/admin/me                     # 401 UNAUTHORIZED
PW=$(grep '^DEV_ADMIN_PASSWORD=' ../.env | cut -d= -f2-)
curl -s -c /tmp/jar -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d "{\"email\":\"owner@drakon.local\",\"password\":\"$PW\"}" localhost:8080/api/admin/login
unset PW
curl -s -b /tmp/jar localhost:8080/api/admin/me          # {"admin":{"id":1,"email":"owner@drakon.local","role":"OWNER"}}
curl -s -b /tmp/jar -X POST -H 'Origin: https://evil.example' localhost:8080/api/admin/logout   # 403 BAD_ORIGIN
curl -s -b /tmp/jar -c /tmp/jar -X POST -H 'Origin: http://localhost:5173' localhost:8080/api/admin/logout  # {"ok":true}
```

### Decisions and questions
- **Context7 had no docs for `golang.org/x/crypto/bcrypt` or `golang.org/x/term`.** I read the official docs of the exact downloaded versions with `go doc` instead (`bcrypt.GenerateFromPassword`, `CompareHashAndPassword`, the 72-byte limit; `term.ReadPassword`, `term.IsTerminal`).
- New Go dependencies: `golang.org/x/crypto` (bcrypt) and `golang.org/x/term` (hidden password), as allowed. `golang.org/x/sys` came in as their helper.
- **A paused (locked) account gets the same answer** as a wrong password: "Wrong email or password. After 5 wrong tries in a row, login pauses for 15 minutes." A separate "locked" message would tell an attacker that the email exists. The message itself explains the pause to you.
- **COOKIE_SECURE stays true.** It works on `http://localhost` (Chrome, Firefox and curl treat localhost as secure). It would NOT work if you open the dev site from your phone at `http://192.168.x.x:5173`: then set `COOKIE_SECURE=false` in `.env` for that test only (the server prints a warning).
- **Missing `Origin` header on a change = 403**, also for login. Browsers always send it. For curl add `-H 'Origin: http://localhost:5173'`.
- Session lengths (12 h idle, 7 days max) are security constants in code, not business values, so they are not in `settings`. Tell me if you want them there.
- One Owner only, enforced by the database. A Staff role later = add a value to the `admin_role` enum.
- `dev-owner` run again = a new random password for the same dev owner (handy if you lose it).
- Your `.env` file can be read by other users on your PC (`-rw-rw-r--`). Optional: `chmod 600 ~/Desktop/projects/Drakon/drakon/.env`.

---

## Phase 2: admin shell (web)

### What I built
- **`/admin/*` routes** in `web/src/pages/admin/AdminApp.tsx`, loaded as a **separate file** (`React.lazy`): a shopper never downloads admin code. The shop's providers (settings, delivery, cart) now wrap only the shop routes, so the admin does not wait for them.
- **`/admin/login`** (`AdminLogin.tsx`), styled like the customer Sign in screen: form on the left, the hoodie-tag photo on the right (desktop only), Show/Hide password button, one error line, one orange button.
- **Auth guard** (`RequireAdmin`): asks `GET /api/admin/me`. Not logged in → `/admin/login`, and after login you go back to the page you wanted.
- **Admin layout** (`components/admin/AdminLayout.tsx`) following AdminNav.dc.html: menu on the left on desktop (logo "Drakon Admin", menu items, "Owner" + your email, Log out). On a phone: a bar on top with a **Menu** button that opens the same menu.
- **Logout**: deletes the session on the server, forgets all loaded admin data in the tab, goes to the login page.
- **Any 401 later** (session ended while you work) sends you back to the login page.
- `<meta name="robots" content="noindex, nofollow">` on every admin page (and the API sends `X-Robots-Tag: noindex`).
- No link to `/admin` anywhere in the shop (I checked the home page: 0 links containing "admin").

### Why
You need a safe door to the admin, and a frame that works on your phone, before the order screens go in.

### Key concepts (for a beginner)
- **The browser cannot see the cookie** (HttpOnly). So the web app cannot know by itself if you are logged in; it asks the server (`/api/admin/me`) when the admin opens.
- **Auth guard**: a component that sits in front of the admin pages. Not logged in → it renders `<Navigate to="/admin/login">` instead of the page.
- **Code splitting** (`lazy(() => import(...))`): Vite puts the admin into its own JavaScript file, downloaded only when someone opens `/admin`. The security is still on the server: hiding code is not protection, the session check is.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api && make run        # terminal 1
cd ~/Desktop/projects/Drakon/drakon/web && npm run dev     # terminal 2
```
1. Open http://localhost:5173/admin → you land on **/admin/login**.
2. Type a wrong password → "Wrong email or password. After 5 wrong tries in a row, login pauses for 15 minutes."
3. Log in with `owner@drakon.local` and the password from `.env` (`DEV_ADMIN_PASSWORD`) → the Dashboard.
4. Make the window narrow (or use your phone): the menu moves into the top bar.
5. **Log out** → back to the login page. Press the browser's Back button: still the login page.

### Decisions and questions
- I checked the login page in Chrome through page scripts: the guard redirect, the error message, `aria-invalid` and the `noindex` tag work. **Screenshots failed** (Chrome did not answer screenshot requests, probably because the window was not visible), so I could not look at the design with my own eyes.
- **I did not test the logged-in pages in the browser.** To do that I would have had to copy a session token into the browser, and the safety system blocked reading the token (correct: it is a credential). I ended that test session and deleted the files. Please click through the logged-in pages in the morning (checklist at the end).
- No `robots.txt` entry for `/admin`: a robots.txt line would *tell* everyone where the admin is. The `noindex` tag and header are enough.
- No "Forgot password?" email link (no email yet). The login page says to run `make reset-password` on the server.
