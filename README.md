# DRAKON

Premium dark collectible & lifestyle brand — e-commerce website (Bangladesh, ৳, Cash on Delivery).

| Folder | What |
|---|---|
| `web/` | Frontend — Vite + React + TypeScript + Tailwind. All customer pages, using mock data. Ordering is disabled until the API exists. |
| `api/` | Backend — Go REST API *(not created yet)* |
| `docs/` | Blueprint, brand vision, open questions, design reference, progress logs |

## Run the frontend

Needs Node 22+.

```zsh
cd web
npm install
npm run dev
```

Open http://localhost:5173.

Other commands (inside `web/`): `npm run build` (production build into `web/dist/`), `npm run lint`.

## Status

Roadmap steps 1–3 are done (frontend with mock data). Next: step 4, local PostgreSQL. See `docs/blueprint.md`, part 10.
