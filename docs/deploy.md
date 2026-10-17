# Deploying DRAKON (step by step, for later)

Nothing here has been run yet. This is the plan for the day you go live. Everything stays on **free plans**.

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
   - Choose the **direct** connection (not "pooled"). With one small server it is simpler and safe with pgx.
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
| Name | `drakon-api` (your address becomes `https://drakon-api.onrender.com`) |
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

   Do **not** set `PORT`: Render sets it, and the server listens on it.
5. Create the service. The first build takes a few minutes. When it is "Live", open `https://drakon-api.onrender.com/api/health`: you should see `{"database":"ok","status":"ok"}`.

The background sweep (auto-cancel after 48 h, auto-archive after 7 days) runs inside this server: when it starts and every 10 minutes while it is awake, and before the admin opens orders. A sleeping server misses nothing: the next request catches up.

## 5. Cloudflare: the website and the /api forwarder 🔑

1. Sign up at dash.cloudflare.com. Under **Workers & Pages** you get a free subdomain, like `drakon-abu.workers.dev`.
2. Point the Worker at your Render API: in `web/wrangler.jsonc`, set
   `"API_ORIGIN": "https://drakon-api.onrender.com"` (your Render address, no slash at the end). Commit this change.
3. On your PC:
   ```zsh
   cd ~/Desktop/projects/Drakon/drakon/web
   npm run build                   # makes web/dist
   npx wrangler login              # 🔑 opens the browser, log in to Cloudflare, allow wrangler
   npx wrangler deploy             # uploads dist/ + worker/index.ts; prints your https://drakon.<sub>.workers.dev address
   ```
   (`npx wrangler` downloads the Cloudflare tool the first time. It is Cloudflare's official tool.)
4. Go back to Render and set `ALLOWED_ORIGINS` to exactly the address wrangler printed (with `https://`, no slash at the end). Save; Render restarts the API.

## 6. Check that everything works

1. `https://drakon.<sub>.workers.dev/api/health` → `{"database":"ok","status":"ok"}` (this goes through the Worker to Render to Neon).
2. `https://drakon.<sub>.workers.dev/` → the shop (empty until you add products).
3. `https://drakon.<sub>.workers.dev/admin/login` → log in with your Owner email and password.
4. Admin → Categories: add your categories. Products → New product: add one, a photo, a variant, stock, then Publish.
5. On your phone: place a test order, confirm it in the admin, cancel it (the stock comes back).

If login does not stick (you land on the login page again): `ALLOWED_ORIGINS` or the address is not exactly the same (https, no trailing slash). If an admin change answers "This change did not come from the DRAKON admin site", it is the same problem.

## Environment variables, all in one place

| Variable | Where | Example | Secret? |
|---|---|---|---|
| `DATABASE_URL` | Render (and your PC's `.env`) | `postgresql://...neon.tech/drakon?sslmode=require` | **yes** |
| `ALLOWED_ORIGINS` | Render | `https://drakon.<sub>.workers.dev` | no |
| `COOKIE_SECURE` | Render | `true` | no |
| `PORT` | set by Render itself | `10000` | no |
| `API_ORIGIN` | `web/wrangler.jsonc` (`vars`) | `https://drakon-api.onrender.com` | no |
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
