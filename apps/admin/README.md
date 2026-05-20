# @peopleclaw/admin

PeopleClaw admin SPA: Vite + React 19 + React Router 7 + Tailwind v4 + shadcn/ui.
Backend: Express + Prisma + Turso (libSQL). Auth: Logto SSO.

## Routes
| Path | Description |
|------|-------------|
| `/` | Public landing / sign-in entry |
| `/signin` → `/callback` | Logto OIDC flow |
| `/dashboard` | Authenticated home |
| `/workflows` | Workflow editor (React Flow canvas, sidebar of all workflows) |
| `/workflows/:id` | Specific workflow loaded in the editor |
| `/cases` | All cases list |
| `/cases/:id` | Single case detail (P3 placeholder) |

## Stack
- UI primitives: shadcn/ui (Radix + Tailwind v4). No DaisyUI.
- Workflow canvas: `@xyflow/react` 12.x
- State: local component state + `localStorage` (`peopleclaw-workflows`) — server persistence is P5.


## App Chat model integration

The canonical PeopleClaw App Chat page is `/app/:id/chat`. The frontend uses `@united-robotics/agent-ui-core` (`AgentChatSurface` plus `createFetchAgentChatTransport`) and talks only to the PeopleClaw API under `/api/apps/:appId/agent-sessions` and `/api/apps/:appId/agent-sessions/:sessionId/messages`.

The server route is `src/server/routes/agentChat.ts`. It stores per-App chat sessions, streams SSE events back to the browser, and calls `streamCodexAgent` in `src/server/lib/codexAgent.ts`. `streamCodexAgent` uses PI (`@mariozechner/pi-ai`) `streamSimple` with provider `openai-codex` against the ChatGPT Codex responses endpoint. The default model is `gpt-5.5`; override with `PEOPLECLAW_CODEX_MODEL` only when needed.

Required production env vars:

- `PEOPLECLAW_CODEX_ACCESS_TOKEN`
- `PEOPLECLAW_CODEX_REFRESH_TOKEN`

Optional metadata / tuning env vars:

- `PEOPLECLAW_CODEX_EXPIRES`
- `PEOPLECLAW_CODEX_EMAIL`
- `PEOPLECLAW_CODEX_ACCOUNT_ID`
- `PEOPLECLAW_CODEX_PLAN_TYPE`
- `PEOPLECLAW_CODEX_MODEL`

Production must use env-provided OAuth tokens. Local development may instead point at an explicit PI/OpenClaw auth profile store with `PEOPLECLAW_CODEX_AUTH_PROFILES_PATH` (and optionally `PEOPLECLAW_CODEX_AUTH_PROFILE`). Tokens are server-side only; the frontend never receives access or refresh tokens.

DeepSeek is not part of the current App Chat/model path. The old `/api/chat` DeepSeek route has been removed; App Chat should use the agent-session routes above.

## data-testid Convention (for Playwright e2e)

| Element                   | Pattern                                    |
|---------------------------|--------------------------------------------|
| Sidebar workflow item     | `sidebar-workflow-{workflowId}`            |
| Sidebar category          | `sidebar-category-{categoryName}`          |
| Sidebar search input      | `sidebar-search`                           |
| Step node (React Flow)    | `step-node-{stepId}`                       |
| Step status indicator     | `step-status-{stepId}`                     |
| Step subflow toggle       | `step-action-toggle-{stepId}`              |
| Subflow group container   | `subflow-group-{label}`                    |
| Subflow collapse button   | `subflow-collapse`                         |
| Add step button           | `add-step-button`                          |
| Add step modal            | `add-step-modal`                           |
| Step type option          | `step-type-{type}`                         |
| Detail panel container    | `detail-panel`                             |
| Detail panel field        | `step-detail-{fieldName}` (e.g. `step-detail-name`, `step-detail-assignee`, `step-detail-description`, `step-detail-estimatedTime`, `step-detail-type`) |
| Save / Cancel / Delete    | `action-save` / `action-cancel` / `action-delete` |
| Tab                       | `tab-{name}` (`tab-workflow`, `tab-cases`) |
| Cases table / grid        | `cases-table`                              |
| Case row                  | `case-row-{caseId}`                        |
| Case banner (in canvas)   | `case-banner`                              |
| Case detail page          | `case-detail-{caseId}`                     |
| Top-nav workflows link    | `nav-workflows`                            |
| Top-nav cases link        | `nav-cases`                                |

## Build
```
pnpm --filter @peopleclaw/admin build
```
Outputs SPA to `dist/` and Express server to `api-dist/`.

## Dev
```
pnpm --filter @peopleclaw/admin dev
```

## E2E Seed (PLANET-925 P3.16)

```
pnpm --filter @peopleclaw/admin seed:e2e
```

Idempotent. Ensures a canonical acceptance state:

- Logto user `demo_acceptance_test` (password `DemoAccept2026!`) via Management M2M
  (set `LOGTO_M2M_APP_ID` + `LOGTO_M2M_APP_SECRET`; falls back to placeholder
  logtoId if M2M creds aren't present so DB seeding still works)
- Tenant slug `acceptance` with the demo user as `owner`
- Workflows `shopify-auto-smoketest` (3 nodes) and `shopify-product-listing-demo` (5 nodes)
- 12 step templates (delegates to `seed-step-templates.mjs`)
- Shopify Connection (copies `client_id`/`client_secret` from default tenant if present)

### Sudo login (test-only)

When `E2E_TEST_TOKEN` is set, the server mounts `POST /api/test/sudo-login`:

```bash
curl -X POST $BASE/api/test/sudo-login \
  -H "Authorization: Bearer $E2E_TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 42, "tenantSlug": "acceptance"}'
# → { userId, tenantId, tenantSlug, sudoToken, usage }
```

Subsequent requests bypass Logto by sending:

```
Authorization: Sudo <E2E_TEST_TOKEN>
X-Sudo-User-Id: <userId>
```

In production `E2E_TEST_TOKEN` MUST be unset; the route then 404s and the
sudo branch in `requireAuth` is inert.

<!-- redeploy: codex env 2026-05-13 -->
