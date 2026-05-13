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

## App Chat mutation smoke (PLANET-1675)

Full Codex browser E2E is intentionally not required for every local run because it depends on a live Codex credential/session and can be slow/flaky. The server-side smoke below exercises the same `executeAppAgentTool` toolbox used by native App Chat, persists a page/component in a disposable SQLite database, verifies the created page through `list_app_modules`, and verifies the chat session stores the user prompt, tool result, and assistant summary.

```bash
pnpm --filter @peopleclaw/admin smoke:app-chat-mutation
```

Manual prod QA, when Codex is connected:

1. Open `https://app.peopleclaw.rollersoft.com.au` and sign in.
2. Open or create a test App, then go to `/app/<appId>/chat`.
3. Ask: “Add a new public dashboard page called Smoke Metrics to this App.”
4. Confirm the chat reports a tool/action completed.
5. Open the App canvas/modules/API view and confirm `Smoke Metrics` appears as an exported page/component.
6. Reopen the chat session and confirm the prompt, tool result, and assistant summary remain visible.
