# PeopleClaw Admin — E2E Tests (PLANET-889)

Playwright e2e tests covering auth, workflow editor, and the e-commerce case flow.

## Prerequisites

- Node 20+, pnpm 10+
- Playwright browsers: `pnpm --filter @peopleclaw/admin exec playwright install --with-deps chromium`
- An `acceptance` tenant + `demo_acceptance_test` Logto user must exist
  - Run `pnpm --filter @peopleclaw/admin run seed:e2e` to provision (idempotent)

## Environment Variables

| Var | Default | Notes |
|-----|---------|-------|
| `PLAYWRIGHT_BASE_URL` | `https://admin.peopleclaw.rollersoft.com.au` | Set to `http://localhost:3000` for local |
| `E2E_USERNAME` | `demo_acceptance_test` | Logto username |
| `E2E_PASSWORD` | `DemoAccept2026!` | Logto password (skips MFA per docs/GOTCHAS.md) |
| `SHOPIFY_MOCK` | `true` | Backend handler returns fake product id |
| `AI_MOCK` | `true` | Backend handler returns canned description |

## Running

```bash
# All tests against deployed admin
pnpm --filter @peopleclaw/admin exec playwright test

# Local dev
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  pnpm --filter @peopleclaw/admin exec playwright test

# Single file
pnpm --filter @peopleclaw/admin exec playwright test e2e/auth.spec.ts

# Show last HTML report
pnpm --filter @peopleclaw/admin exec playwright show-report
```

## Files

- `playwright.config.ts` — config (project root)
- `e2e/auth.spec.ts` — Logto sign-in + nav smoke
- `e2e/workflow-editor.spec.ts` — open editor, add step, save, reopen
- `e2e/case-flow.spec.ts` — full e-commerce case flow (create → human steps → AI → Shopify → done)
- `e2e/fixtures/auth.ts` — shared auth fixture (signs in once, stores state)

## CI

GitHub Actions workflow: `.github/workflows/e2e.yml` — runs on push to `main`
against the deployed admin URL.
