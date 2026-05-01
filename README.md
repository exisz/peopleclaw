# PeopleClaw

[![E2E](https://github.com/exisz/peopleclaw/actions/workflows/e2e.yml/badge.svg)](https://github.com/exisz/peopleclaw/actions/workflows/e2e.yml) [![Report](https://img.shields.io/badge/E2E_Report-live-blue)](https://exisz.github.io/peopleclaw/)

Workflow automation for SMEs and freelance IT.

A pnpm monorepo with two independent Vercel deployments:

- **`apps/landing`** — Astro + Tailwind + DaisyUI marketing site (static + markdown blog).
- **`apps/admin`** — Vite/React SPA + Express API, Logto auth, Prisma + Turso persistence.

Built on the [`genstack-astro-spa-api-2deploys`](https://github.com/exisz/genstack-astro-spa-api-2deploys) template. Original template docs live in `ROADMAP.md` and `docs/`.

## Quickstart

Requirements: Node 20+, pnpm 10.30.3 (`corepack enable` or `npx pnpm@10.30.3`).

```bash
pnpm install

# Marketing site (Astro)
pnpm run dev:landing      # http://localhost:4321
pnpm run build:landing

# Admin app (Vite SPA + Express API)
cp .env.example apps/admin/.env   # fill in Logto + DB
pnpm run dev:admin                # http://localhost:5173
pnpm run build:admin
```

## Layout

```
apps/
  landing/   Astro marketing site → deploys to peopleclaw.com
  admin/     SPA + API → deploys to app.peopleclaw.com
docs/        Architecture / deploy notes (inherited from template)
scripts/     Shared utility scripts (e.g. db-push-remote.mjs)
.archive/    Pre-template POC code, kept for reference
```

## Deployment

Each app deploys as its own Vercel project, both pointing at this repo with a per-app `rootDirectory`. See `ROADMAP.md` and `docs/` for full deploy notes.

## License

See `LICENSE`.
