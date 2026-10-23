# Overnight run 2026-10-24: full audit

Written for Abu Bakkar Siddik, in simple English. Tonight is **not for new features**: I check everything built so far, find problems and fix only the clear, safe bugs (each with a test and its own small commit). Nothing in this run was pushed to GitHub.

Security details of problems that are **not fixed yet** are not in this file (the repo is public). They are in the private report `~/Desktop/projects/Drakon/reports/audit-2026-10-24.md`.

## Plan

- [x] 0. Start: clean git, database up, all checks pass, tool list
- [x] 1. Security scan (manual review; the plugin could not run here)
- [ ] 2. Business rules vs. the code
- [ ] 3. API contract check
- [ ] 4. Real browser check of every page
- [ ] 5. Database check
- [ ] 6. Code health
- [ ] 7. Docs check
- [ ] 8. Finish

---

## Phase 0: start

### What I checked
- Read `CLAUDE.md`, `docs/blueprint.md` (business rules 1–10), `docs/open-questions.md` (questions 1–18), `docs/api.md`, `docs/deploy.md`, `.env.example` and the earlier logs in `docs/progress/`.
- `git status` on `main`: no changes to tracked files. One **untracked** folder: `web/src/components/_preview/ProductCardPreview.tsx` (dated 2026-10-21). It is not mine and not in any commit, so I left it exactly as it is. It does not break the build or the lint.
- `make db-up`: the database container is healthy.
- `make migrate-status`: 6 migrations applied (00001–00006).
- `make check`: gofmt, go vet and all Go tests pass.
- `npm run build` and `npm run lint`: both pass, no warnings.

### Tools I have tonight
| Tool | Kind | Where I use it |
|---|---|---|
| `claude-security` 0.12.0 | plugin (skill + agents) | Phase 1, full scan |
| `playwright` (Playwright MCP) | plugin / MCP server | Phase 4, real browser |
| `playwright-skill` 5.0.0 | plugin skill | backup for Phase 4 |
| `gopls-lsp`, `typescript-lsp` | plugins (LSP) | Phase 6: find references, unused code |
| Context7 | MCP server | library docs before any config change |
| graphify | skill + `~/Desktop/projects/Drakon/graphify-out/` (made 2026-10-21) | map of the code: which areas have many links and few tests. Not re-run. |
| claude-in-chrome | MCP server | not needed (Playwright is enough) |
| Go 1.27.3, Node 24.21.0, goose, sqlc, gopls | local | all checks |

### What I found
Nothing red. Everything starts clean.

### What I fixed
Nothing (nothing was broken).

### Key concepts (for a beginner)
- **Audit**: reading and testing code that already exists to find mistakes, instead of writing new features.
- **Untracked file**: a file git sees in the folder but that was never added to a commit. `git status` shows it with `??`. Git does not save it until you `git add` it.

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon
git status                          # only web/src/components/_preview/ is untracked
cd api && make db-up && make migrate-status && make check
cd ../web && npm run build && npm run lint
```

---

## Phase 1: security scan

### What I checked
- **claude-security plugin**: it is installed (version 0.12.0), but its scan could not start. The scan runs as a "workflow", and this session does not have the Workflow tool. So no scan ran, and no `CLAUDE-SECURITY-*` folder was made (nothing to move, nothing left in the repo).
- So, as the plan says, I did a **careful manual security review** instead. I read the code for:
  - admin login on every `/api/admin` route (the route table and its test)
  - the Origin check on every admin change (login too)
  - cookie flags, session expiry (12 h idle, 7 days max), logout, password reset
  - the lockout after wrong passwords (also when many tries come at the same moment)
  - SQL: only through sqlc with parameters
  - logs: no personal data
  - photo addresses (type, folder, `..`, `javascript:` links)
  - security headers on the API and on the website (`web/public/_headers`)
  - CORS, error messages, body size, server timeouts
  - the Dockerfile and the Cloudflare Worker
- I checked a Cloudflare detail with **Context7** (how `_headers` patterns match).

### What I found
- **0 High, 1 Medium, 1 Low.** The Medium one is already an open question (4 and 14). Details: see the private report.
- Everything else in the list above is OK. Some good things the code already does:
  - The database stores only a **hash** of the session cookie.
  - Login gives the **same answer** for a wrong email and a wrong password.
  - The admin row is **locked** during a login try, so many tries at once are all counted.
  - Every SQL query uses **parameters**.

### What I fixed
Nothing in this phase. Both findings need a deploy or a decision from you.

### Key concepts (for a beginner)
- **SQL injection**: if code glues user text into an SQL string (`"... WHERE name = '" + name + "'"`), a visitor can type SQL and change the query. **Parameters** (`WHERE name = $1`) send the text separately, so it is always only data. sqlc always uses parameters.
- **Rate limit**: a rule like "at most 10 tries per minute from one IP address". It slows down people who guess passwords or order numbers.
- **Clickjacking**: a bad site shows your page inside an invisible frame and tricks you into clicking. The header `frame-ancestors 'none'` tells the browser "never show this page in a frame".

### How to test it yourself
```zsh
cd ~/Desktop/projects/Drakon/drakon/api
make run                                    # terminal 1
# terminal 2:
curl -si -X POST localhost:8080/api/admin/logout | head -1                    # 403: no Origin
curl -si -X POST -H 'Origin: https://evil.example' localhost:8080/api/admin/logout | head -1   # 403
curl -si localhost:8080/api/admin/orders | head -1                            # 401: no cookie
curl -si localhost:8080/api/health | grep -i 'x-frame\|nosniff'              # security headers
```
