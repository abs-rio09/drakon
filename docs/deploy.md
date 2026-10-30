# Deploying DRAKON (step by step, for later)

DRAKON went live on 2026-10-30 by following these steps. Everything stays on **free plans**.

- Shop: https://drakon.abubakkar.workers.dev
- API (Render): https://drakon-api-uq0h.onrender.com
- Database: Neon, Singapore

The notes marked **Learned on launch day** are things that went wrong the first time.

```
Browser ──► Cloudflare Worker (drakon.<you>.workers.dev)
              ├─ the website (the files from `npm run build`)
              └─ /api/*  ──► Render (the Go API, Docker)  ──► Neon (PostgreSQL)
```

Steps marked **🔑** need one of your own accounts (I could not and did not do them). The other steps run on your PC.

| Service | What it runs | Free plan notes |
|---|---|---|
| **Neon** 🔑 | the PostgreSQL database | sleeps after a few idle minutes, wakes on the next query |
| **Render** 🔑 | the Go API from `api/Dockerfile` | sleeps after ~15 idle minutes; the first visit then takes 30–60 s |
| **Cloudflare** 🔑 | the website + the `/api` forwarder (`web/worker/index.ts`) | 100,000 requests per day |
| **GitHub** 🔑 | your code (Render builds from it) | you already have it |

Before you start: `git push` your work, because Render builds from GitHub.

---

## 1. Neon: the database 🔑

1. Sign up at neon.tech (a GitHub login works).
2. Create a project:
   - name `drakon`
   - Postgres version: the newest
   - region: **AWS Asia Pacific (Singapore)**, the closest one to Bangladesh
3. Create (or use) a database called `drakon`.
4. On the project dashboard, open **Connect** and copy the connection string. It looks like
   `postgresql://drakon_owner:XXXX@ep-something-123456.ap-southeast-1.aws.neon.tech/drakon?sslmode=require`
   - Turn **Connection pooling OFF** so you get the **direct** address. The host must **not** contain `-pooler`.
   - **Learned on launch day:** with the pooled `-pooler` address, goose fails with
     `prepared statement name is already in use`. The pooler (PgBouncer) mixes up the prepared statements that pgx uses. The direct address fixes it.
   - Use the same direct address for `DATABASE_URL` on Render too.
   - This string contains the password. **Never** put it in a file in the repo, a commit, a chat or a screenshot.

## 2. Create the tables on Neon (your PC)

goose (the migration tool) runs the same files that built your local database.

```zsh
cd ~/Desktop/projects/Drakon/drakon/api      # api/ has no .env, so nothing local gets mixed in
read -s NEON_URL                              # paste the Neon string, press Enter (nothing shows)
GOOSE_DRIVER=postgres GOOSE_DBSTRING="$NEON_URL" GOOSE_MIGRATION_DIR=db/migrations \
  $(go env GOPATH)/bin/goose up
GOOSE_DRIVER=postgres GOOSE_DBSTRING="$NEON_URL" GOOSE_MIGRATION_DIR=db/migrations \
  $(go env GOPATH)/bin/goose status           # every migration says "Applied At ..."
```

Why `read -s`: the password goes into a shell variable for this terminal only. It is not shown on the screen and not saved in your zsh history.

**Do not run `make seed` on Neon.** The sample products are for your PC. On the live site you add the real categories and products in the admin panel. (The migrations already add the settings, the two delivery zones and all 64 districts.)

## 3. Create your Owner account on Neon (your PC)

In the same terminal (it still has `$NEON_URL`):

```zsh
DATABASE_URL="$NEON_URL" go run ./cmd/admin create-owner --email you@example.com
```

- It prints `Database: ep-...neon.tech/drakon`: check that it is Neon, not localhost.
- Type a strong password twice (at least 12 characters, nothing shows while you type). Use a password manager.
- `dev-owner` refuses to run here on purpose (it only works on a local database).
- Lost the password later? `DATABASE_URL="$NEON_URL" go run ./cmd/admin reset-password --email you@example.com`

Close the terminal when you are done (that forgets `$NEON_URL`).

## 4. Render: the API 🔑

1. Sign up at render.com with GitHub and allow it to read the `drakon` repository.
2. **New → Web Service**, choose the `drakon` repository.
3. Settings:

| Field | Value |
|---|---|
| Name | `drakon-api` (Render adds a random ending; ours became `https://drakon-api-uq0h.onrender.com`) |
| Region | **Singapore** (next to Neon) |
| Branch | `main` |
| Root Directory | `api` |
| Runtime / Language | **Docker** (Render finds `api/Dockerfile`) |
| Instance type | **Free** |
| Health Check Path | `/api/health` |

4. **Environment variables** (Render → Environment):

| Key | Value | Why |
|---|---|---|
| `DATABASE_URL` | the Neon string from step 1 | where the data is (secret) |
| `ALLOWED_ORIGINS` | `https://drakon.<your-subdomain>.workers.dev` | only your site may send admin changes (CSRF guard). Fill in after step 5, then redeploy |
| `COOKIE_SECURE` | `true` | the admin cookie only travels over HTTPS |
| `TRUSTED_PROXY` | `cloudflare` | the per-IP rate limits use the visitor's IP that the Worker passes on |
| `PROXY_SECRET` | a long random text: `openssl rand -hex 32` (secret) | proves a request really came through your Worker. The **same** value goes into the Worker in step 5 |

   Do **not** set `PORT`: Render sets it, and the server listens on it.

   **Learned on launch day:** the name must be exactly `PROXY_SECRET` (not `DRAKON_PROXY_SECRET` or anything else). With `TRUSTED_PROXY=cloudflare` the server **refuses to start** when `PROXY_SECRET` is missing, so a wrong name shows up as a failed deploy in the Render logs.
5. Create the service. The first build takes a few minutes. When it is "Live", Render shows your real address at the top of the page (ours: `https://drakon-api-uq0h.onrender.com`). Open `<that address>/api/health`: you should see `{"database":"ok","status":"ok"}`.

The background sweep (auto-cancel after 48 h, auto-archive after 7 days) runs inside this server: when it starts and every 10 minutes while it is awake, and before the admin opens orders. A sleeping server misses nothing: the next request catches up.

## 5. Cloudflare: the website and the /api forwarder 🔑

1. Sign up at dash.cloudflare.com. Under **Workers & Pages** you get a free subdomain, like `drakon-abu.workers.dev`.
2. Point the Worker at your Render API: in `web/wrangler.jsonc`, set
   `"API_ORIGIN": "https://drakon-api-uq0h.onrender.com"` (your **real** Render address, no slash at the end). Commit this change.
   **Learned on launch day:** Render added a random ending (`-uq0h`), so the address is not simply `drakon-api.onrender.com`. Copy it from the Render page; if it does not match, every `/api` call through the Worker fails.
3. On your PC:
   ```zsh
   cd ~/Desktop/projects/Drakon/drakon/web
   npm run build                   # makes web/dist
   npx wrangler login              # 🔑 opens the browser, log in to Cloudflare, allow wrangler
   npx wrangler deploy             # uploads dist/ + worker/index.ts; prints your https://drakon.<sub>.workers.dev address
   ```
   (`npx wrangler` downloads the Cloudflare tool the first time. It is Cloudflare's official tool.)

   **Learned on launch day:**
   - The first `wrangler deploy` asks you to register a `workers.dev` subdomain (ours: `abubakkar`). Say yes and pick a name.
   - A brand new subdomain can show `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` in the browser for several minutes. The HTTPS certificate is not ready yet. Nothing is broken: wait 5 to 15 minutes and reload.
4. Go back to Render and set `ALLOWED_ORIGINS` to exactly the address wrangler printed (with `https://`, no slash at the end). Save; Render restarts the API.
5. Give the Worker the same `PROXY_SECRET` as Render (a Worker secret, never in `wrangler.jsonc`, never in git):
   ```zsh
   npx wrangler secret put PROXY_SECRET   # 🔑 paste the value from Render when it asks
   ```
   Why: behind the Worker, every request reaches Render from a Cloudflare address, so without the visitor's real IP all buyers would share one rate limit. But the Render address is public too, and anyone can send a fake `X-Forwarded-For` header to it. So the API believes the visitor IP only from a request that carries this secret.

## 6. Check that everything works

First the quick automatic check (only GET requests: it never logs in, never orders, never changes data):

```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make smoke URL=https://drakon.abubakkar.workers.dev API=https://drakon-api-uq0h.onrender.com
```

Every line should say `OK`, and the last line `All checks passed.` It checks the health endpoint (directly and through the Worker), the home page, the public API answers, the security headers, and that `/admin` pages send `noindex` + `no-store`. The first run after a quiet time can take a minute while Render wakes up.

Then by hand:

1. `https://drakon.<sub>.workers.dev/api/health` → `{"database":"ok","status":"ok"}` (this goes through the Worker to Render to Neon).
2. `https://drakon.<sub>.workers.dev/` → the shop (empty until you add products).
3. `https://drakon.<sub>.workers.dev/admin/login` → log in with your Owner email and password.
4. Admin → Categories: add your categories. Products → New product: add one, a photo, a variant, stock, then Publish.
5. On your phone: place a test order, confirm it in the admin, cancel it (the stock comes back).

If login does not stick (you land on the login page again): `ALLOWED_ORIGINS` or the address is not exactly the same (https, no trailing slash). If an admin change answers "This change did not come from the DRAKON admin site", it is the same problem.

## Keeping secrets safe

- **Never paste a secret** (the Neon string, `PROXY_SECRET`, a password) into a chat, an issue, a commit or a screenshot. That includes chats with an AI helper.
- After typing or showing a secret in a terminal, run `clear` (and close the terminal), so it is not left on screen for the next screenshot.
- Use `read -s` (step 2) so a secret never lands in your zsh history.
- If a secret did leak: make a new one (Neon: reset the password; `PROXY_SECRET`: `openssl rand -hex 32`), put it on Render and in the Worker, and redeploy.

## Environment variables, all in one place

| Variable | Where | Example | Secret? |
|---|---|---|---|
| `DATABASE_URL` | Render (and your PC's `.env`) | `postgresql://...neon.tech/drakon?sslmode=require` (direct, no `-pooler`) | **yes** |
| `ALLOWED_ORIGINS` | Render | `https://drakon.<sub>.workers.dev` | no |
| `COOKIE_SECURE` | Render | `true` | no |
| `TRUSTED_PROXY` | Render | `cloudflare` (empty on your PC) | no |
| `PROXY_SECRET` (exactly this name) | Render **and** the Worker (`npx wrangler secret put PROXY_SECRET`) | `openssl rand -hex 32` | **yes** |
| `PORT` | set by Render itself | `10000` | no |
| `API_ORIGIN` | `web/wrangler.jsonc` (`vars`) | `https://drakon-api-uq0h.onrender.com` | no |
| `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` | only your PC's `.env` (dev) | made by `make dev-owner` | yes, never on a server |

## Product photos for now

Until Cloudflare R2 uploads are built, a photo is a file in `web/public/img/` that you add by its address (`/img/p-my-product.webp`) in the admin. So: copy the photo there, `npm run build`, `npx wrangler deploy`, then add it to the product. The code is ready for R2 (`api/internal/images`): an R2 store replaces the "links" store later.

## Before real customers (short checklist)

- [ ] Strong Owner password in a password manager; nobody else knows it.
- [ ] `ALLOWED_ORIGINS` is exactly your site; `COOKIE_SECURE=true`.
- [ ] Rate limiting decided (open question 4).
- [ ] Neon backups: check what the free plan keeps (point-in-time restore window) and make a manual backup (`pg_dump`) before big changes.
- [ ] The real return, terms and privacy texts are on the policy pages.
- [ ] One full test order on a phone from start to delivered.

## Build the API image on your PC (optional)

Docker downloads the Go image (about 1 GB) the first time.

```zsh
cd ~/Desktop/projects/Drakon/drakon/api
docker build -t drakon-api .
# stop `make run` first (it also uses port 8080)
docker run --rm --network host -e DATABASE_URL="$(grep '^DATABASE_URL=' ../.env | cut -d= -f2-)" drakon-api
# another terminal: curl localhost:8080/api/health
```
`--network host` lets the container use your PC's network, so `localhost:5432` reaches the database container.
