# DRAKON — rules for Claude Code

## Who you are working with
- Abu Bakkar Siddik, CSE student. Knows C, C++, Go basics, HTML, CSS. **New to** JavaScript, TypeScript, React, Tailwind, SQL, PostgreSQL.
- **Explain in simple English**, beginner-friendly (not Bangla: it renders broken in his terminal). Code, commands and comments stay in English.
- Work in **small steps, one at a time**. After each step: say what to run, what he should see, then stop and wait.
- Every implementation step covers: what we build → why → files → code → how to run → how to test → common errors.
- Teach only the minimum concept needed for the current step, then apply it to DRAKON immediately.
- Address him as "Abu Bakkar Siddik" (or "Abu Bakkar"). Never just "Abu", and never a nickname. This is professional work.
- He uses Ubuntu + zsh. Give exact commands ready to paste.

## What DRAKON is
Premium dark collectible / lifestyle brand (cards, sports toys, tech toys, clothes). Bangladesh only, prices in ৳ (BDT).
Full plan: `docs/blueprint.md` (business rules = source of truth). Brand story: `docs/brand-vision.md`.
Open decisions: `docs/open-questions.md` — **do not build anything marked 🟡 until Abu Bakkar Siddik answers it.**

## Stack (decided — do not change without asking)
- `web/` — Vite + React + TypeScript + Tailwind CSS. **Not Next.js.** Routing with react-router.
- `api/` — Go standard `net/http` + pgx + sqlc + goose. **No ORM. No Node/Express backend.**
- PostgreSQL (Docker locally, Neon in production).
- Hosting later: Cloudflare Workers Static Assets (web + `/api` proxy), Render (api), Neon (db), R2 (images). Free tiers only.
- In dev, Vite proxies `/api` → Go server, so the browser always talks to one origin.

## Hard rules
1. **Server decides money.** Prices, stock, delivery charge, limits are computed in Go from the database. Never trust prices sent by the browser.
2. **Money is integer paisa** (`BIGINT`, `price_paisa`), with a `currency` column. Never float. Format to ৳ only in the UI.
3. **No hard-coded business values.** 60/100 delivery, 48 h COD call, purchase limit 5, return 3 days, archive 7 days → `settings` / `delivery_zones` tables.
4. **Payment = Cash on Delivery only** for the MVP. No fake payment integrations, no fake gateways.
5. **Never delete products or orders.** Lifecycle: `DRAFT → ACTIVE ⇄ SOLD_OUT → ARCHIVED`.
6. **Stock decrement** inside a transaction with `UPDATE ... SET stock = stock - $1 WHERE id = $2 AND stock >= $1`; 0 rows = out of stock → rollback.
7. Order statuses: `PENDING → CONFIRMED → SHIPPED → DELIVERED`, or `CANCELLED`.
8. Auth: HttpOnly session cookie + bcrypt. No JWT in localStorage.
9. **Secrets never in git.** `.env` is ignored; commit only `.env.example`.
10. Schema changes only through new goose migration files. Never edit an applied migration.
11. Original art only — no real-brand logos, characters or card designs.

## Design
- Dark only. Tokens: `docs/design/tokens.json`. Rules: `docs/design/README.md` + `docs/design/components/*/README.md`.
- Screen mockups to copy layout from: `docs/design/screens/*.dc.html` — read them as HTML/CSS reference (they need the canvas runtime, so they don't render standalone). Live view: https://claude.ai/code/artifact/c00ae8d0-de73-4f36-850c-fcc74e04bd75
- Dummy product photos (original art, OK to use in dev): `docs/design/screens/img/` — copy needed ones into `web/public/img/`.
- Colors: midnight `#0a0f1b` page, bone `#f6f3ee` text, steel `#b3b8c4` secondary, ember `#ed751a` **only** for the logo and the one main action per screen.
- Fonts: Outfit + Noto Sans Bengali (needed for the ৳ sign). 4/8 px spacing grid. Subtle animation only.

## Folder layout on Abu Bakkar Siddik's PC
- Repo: `~/Desktop/projects/Drakon/drakon` (this folder).
- Parent `~/Desktop/projects/Drakon/` also holds Abu Bakkar Siddik's planning files (`Acheving_Goal.txt`, `Technical_Direction_v2.drawio`, ER diagram HTML, `Extra File/`). Read them only if asked; they are not part of the repo.
- Note: `~/.git` exists (an accidental repo in the home folder). Never run git commands outside this repo.

## Old code
`../drakon-old-nextjs` (= `~/Desktop/projects/Drakon/drakon-old-nextjs`) is the old Next.js + Supabase version. **Reference only.** Copy pieces only when Abu Bakkar Siddik asks, converting `next/link` → react-router `Link`, `next/image` → `<img>`, and dropping Supabase. Never copy its `.env`, `node_modules`, `.next`.

## Git
- Branch `main`, remote `origin` = https://github.com/abs-rio09/drakon (public, created 2026-10-15 with `gh`). Small commits with clear messages. Ask before pushing.
- Do not commit `node_modules/`, `dist/`, `.env`, build output.

## Library notes (checked with Context7, 2026-10-15)
- **Before writing setup or config code for any library, look up current docs with the Context7 MCP.** Don't rely on memory.
- Tailwind v4: `npm install tailwindcss @tailwindcss/vite`; add `tailwindcss()` to `vite.config.ts` plugins; CSS starts with `@import "tailwindcss";`; design tokens go in `@theme { --color-…; --font-… }`. No `tailwind.config.js`.
- React Router v7: `npm i react-router`; import `BrowserRouter, Routes, Route, Link` from `"react-router"` (not `react-router-dom`).
- **Stay on React Router v7** (decided 2026-10-15). Upgrade to v8 only after the frontend MVP is done; then update this line.
- Vite: `npm create vite@latest web -- --template react-ts`; dev proxy `server.proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }` (keep the `/api` prefix — the Go router expects it).
- sqlc: `version: "2"`, `engine: postgresql`, `schema: db/migrations` (goose files; sqlc ignores `-- +goose Down`), `sql_package: "pgx/v5"`. Zero-pad migration names (`00001_catalog.sql`).
- Hosting (decided 2026-10-15): Cloudflare **Workers Static Assets** (not Pages) with `not_found_handling: "single-page-application"` and `run_worker_first: ["/api/*"]` proxying to Render.

## Commands (fill in as the project grows)
- db: `cd api && make db-up` (= `docker compose up -d --wait db`); psql: `docker compose exec db psql -U drakon -d drakon`
- migrations: `cd api && make migrate` / `make migrate-status` (goose reads the repo-root `.env`)
- seed: `cd api && make seed` (`api/db/seed/dev_seed.sql`, safe to run twice, never overwrites)
- api: `cd api && make run` (http://localhost:8080); checks: `make check` (gofmt + vet + test)
- sqlc: `cd api && make sqlc` after changing `api/db/queries/*.sql` or a migration
- tests use the `drakon_test` database (auto-created, wiped per run). Never point tests at `drakon`.
- web: `cd web && npm run dev` (http://localhost:5173); checks: `npm run build` and `npm run lint`
- Go tools live in `$(go env GOPATH)/bin` (goose, sqlc)
- Endpoints: `docs/api.md`
