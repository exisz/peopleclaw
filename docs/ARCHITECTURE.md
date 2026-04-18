# PeopleClaw — Architecture

> Living architecture map for the admin app. Update on every architectural change.
> Companion to `apps/admin/README.md` and the per-project spec (`dna spec planetbuild.projects.peopleclaw --spec`).

## High-level

```
┌──────────────────────┐     ┌──────────────────────────┐      ┌────────────────────┐
│ apps/landing (Astro) │     │ apps/admin (Vite + Expr) │      │  Logto (id.RS.com) │
│ peopleclaw.RS.com.au │     │ admin.peopleclaw.RS.com  │◄────►│  OIDC + Passkey    │
└──────────────────────┘     └────────┬────────────┬────┘      └────────────────────┘
                                      │            │
                                      ▼            ▼
                              ┌──────────────┐  ┌──────────────┐
                              │ Turso (LibSQL)│  │ Stripe       │
                              │ Prisma ORM    │  │ checkout +   │
                              │ tenants/users │  │ webhook      │
                              │ workflows/    │  └──────────────┘
                              │ cases/credits │
                              └──────────────┘
```

Two independent Vercel deployments, both via `git push` to `main`:
- **landing** → marketing static site (Astro)
- **admin** → SPA + Express API (Vercel serverless)

## apps/admin

```
apps/admin/
├── src/
│   ├── client/                # Vite + React 19 SPA
│   │   ├── main.tsx           # Logto provider, Toaster, router
│   │   ├── lib/api.ts         # apiClient (apiFetch + apiJSON + verb helpers)
│   │   ├── lib/logto.ts       # Logto config (endpoint, appId, API resource)
│   │   ├── components/
│   │   │   ├── ui/sonner.tsx  # Toaster (shadcn)
│   │   │   └── workflow/      # Editor + ShortcutHelp + PropertiesPanel + CasesPanel
│   │   └── pages/             # /workflows, /cases, /settings/:tab, /signin
│   └── server/                # Express
│       ├── index.ts           # Dev: vite-express single-process
│       ├── app.ts             # createApp() — wires routers; runs checkEnv() on boot
│       ├── lib/
│       │   ├── prisma.ts      # PrismaClient singleton (Turso libsql adapter)
│       │   ├── env-check.ts   # PLANET-912 — fail-loud env validation
│       │   ├── credits.ts     # credit ledger helpers
│       │   ├── credit-check.ts# pre-step credit gate
│       │   ├── shopifyAuth.ts # Shopify OAuth helpers
│       │   └── starterWorkflow.ts # provisionStarterWorkflow(prisma, tenantId)
│       ├── middleware/
│       │   ├── requireAuth.ts # JWT verify against Logto JWKS
│       │   ├── auth.ts        # session helpers
│       │   └── tenant.ts      # x-tenant-slug → req.tenant
│       └── routes/
│           ├── health.ts      # GET /api/health (liveness) + /api/health/ready (deep)
│           ├── me.ts          # GET /api/me
│           ├── tenants.ts     # POST /api/tenants → provisions starter workflow
│           ├── workflows.ts   # GET/POST/PUT/DELETE
│           ├── cases.ts       # case CRUD + step advance + executor entry
│           ├── credits.ts     # credit packs + Stripe checkout creation
│           ├── stripeWebhook.ts # POST /api/webhooks/stripe (raw body)
│           ├── step-templates.ts
│           ├── internal.ts    # internal admin ops
│           └── test.ts        # gated by E2E_TEST_TOKEN (sudo-login etc)
├── prisma/schema.prisma       # Tenant, User, Workflow, Case, UsageLog, Connection, Credential
├── e2e/                       # Playwright (PLANET-889 — coming)
└── api/index.mjs              # Vercel serverless entry → api-dist/server/app.js
```

## Data flow

### Auth
1. Client redirects to Logto (`/signin` → `logtoClient.signIn`)
2. Logto callback → `/callback` → access token issued for `LOGTO_API_RESOURCE`
3. SPA stores token in `logtoClient`; `apiFetch` attaches `Authorization: Bearer <jwt>`
4. Server `requireAuth` verifies JWT against Logto JWKS

### Tenant resolution
- Client sends `x-tenant-slug: <slug>` (from localStorage `peopleclaw-current-tenant`)
- `requireTenant` middleware → `prisma.tenant.findUnique({ slug })` → `req.tenant`
- New tenants (`POST /api/tenants`) auto-provisioned via `provisionStarterWorkflow` (PLANET-922)

### Case execution
- Step types: `human`, `ai`, `agent`, `subflow`, `trigger` (subflow nested-execution: PLANET-923 split into PLANET-941..945)
- Executor advances on `POST /api/cases/:id/advance`
- AI/handler steps consume credits via `credit-check.ts`; `usageLog` recorded

### Stripe credits
1. Client `POST /api/credits/checkout` → creates Stripe Checkout Session with `metadata.{tenantId, userId, packId, credits}`
2. User pays at Stripe-hosted checkout
3. Stripe → `POST /api/webhooks/stripe` (raw body, signature-verified)
4. Webhook handler increments `tenant.credits` + writes `UsageLog`
5. **Production refuses unsigned webhooks** (PLANET-912 hardening). Dev allows skip-verify with warning.

## Tenant isolation

All tenant data joined on `tenantId`:
- `Workflow` rows: `tenantId === null` = global seed; else owned by tenant
- `Case`, `Connection`, `Credential`, `UsageLog`: hard-required `tenantId`
- API guards: `requireTenant` rejects requests without resolvable slug; cross-tenant access returns 403

## Credit lifecycle

```
purchase (Stripe) → tenant.credits += pack.credits → UsageLog{action:'purchase',creditsAdded}
step run → credit-check before exec → tenant.credits -= step.cost → UsageLog{action:'consume'}
refund (failure) → tenant.credits += step.cost → UsageLog{action:'refund'}
```

## Deployment

| App | Vercel project | Domain | Deploy trigger |
|-----|----------------|--------|----------------|
| admin | peopleclaw-admin | admin.peopleclaw.rollersoft.com.au | `git push main` |
| landing | peopleclaw-landing | peopleclaw.rollersoft.com.au | `git push main` |

**Never** use `vercel deploy` / `vercel --prod`. Env vars set via `vercel env add --scope gotexis` or dashboard.

## Health & ops

- `GET /api/health` — fast liveness (always 200)
- `GET /api/health/ready` — DB ping + Logto OIDC discovery + Stripe key presence; 503 if DB down
- Startup `checkEnv()` warns/errors on missing required env (DB always; Logto + Stripe in prod)
- Sentry: tracked separately — see PLANET-912 item 9

## Known transitional state

- Frontend SPA still also deploys from repo root to legacy `peopleclaw.vercel.app` (POC). New work goes in `apps/admin`.
- Subflow nested execution: schema landed (PLANET-941); executor + UI + properties + E2E in flight (942–945).
