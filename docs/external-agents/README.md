# PeopleClaw — External Coding Agents (Codex / OpenClaw / Claude Code / Cursor)

PeopleClaw exposes **two** control surfaces:

1. **In-platform Chat** — the App owner talks to their App inside `app.peopleclaw.rollersoft.com.au`.
2. **External coding agents** — a developer drives an App from their own coding agent (Codex / OpenClaw / Claude Code / Cursor) through the scoped CLI + API.

For tenants, the fastest path is the **in-app setup page**:

```text
https://app.peopleclaw.rollersoft.com.au/app/<APP_ID>/system/external-agent
```

Open that page while signed in, choose the target App, click **Create Codex key**, then copy the generated setup block. The page fills in the correct base URL, App ID, and one-time `pc_m2m_…` token for that tenant/app. PeopleClaw stores only a token hash, so the secret is never shown again after creation.

## Resources

| Resource | Audience | Path |
|---|---|---|
| **Tenant-specific setup page** | App owners wiring Codex today | `/app/<APP_ID>/system/external-agent` in the PeopleClaw admin app |
| **`@peopleclaw/cli`** — the only allowed channel for external agents | Developers + agents | [`packages/cli/`](../../packages/cli/) |
| **`@peopleclaw/agent-skill`** — drop-in `AGENTS.md` + `SKILL.md` package | Customers wiring up their own coding agent | [`packages/agent-skill/`](../../packages/agent-skill/) |
| **Quickstart** — install → configure → first safe change | Developers | [`packages/agent-skill/templates/QUICKSTART.md`](../../packages/agent-skill/templates/QUICKSTART.md) |
| **AGENTS.md template** — the safety contract | Coding agents | [`packages/agent-skill/templates/AGENTS.md`](../../packages/agent-skill/templates/AGENTS.md) |
| **SKILL.md template** — Skill-convention entry | OpenClaw / Claude Skills agents | [`packages/agent-skill/templates/SKILL.md`](../../packages/agent-skill/templates/SKILL.md) |
| **Troubleshooting** | Developers | [`packages/agent-skill/templates/TROUBLESHOOTING.md`](../../packages/agent-skill/templates/TROUBLESHOOTING.md) |
| **HTTP API reference** | Integrators + platform engineers | [`API.md`](./API.md) |
| **CLI E2E smoke + safety model** | Platform engineers + QA | [`../external-agent-cli-e2e.md`](../external-agent-cli-e2e.md) |

## Tenant quickstart

1. Sign in to PeopleClaw.
2. Open your App, then go to **System → Connect Codex**.
3. Click **Create Codex key**.
4. Copy the token immediately. It is revealed once only.
5. Copy the CLI setup block or the all-in Codex prompt from the page.
6. In the coding-agent workspace, run the safety checks first:

```bash
peopleclaw whoami
peopleclaw apps list
peopleclaw app inspect "$PEOPLECLAW_APP_ID"
```

Then use dry-run before any write and confirm only when the operator intends the exact change.

## Generic setup shape

The in-app page generates real values. Generic external docs should use placeholders only:

```bash
npm install -g @peopleclaw/cli
export PEOPLECLAW_BASE_URL='https://app.peopleclaw.rollersoft.com.au'
export PEOPLECLAW_APP_ID='<APP_ID_FROM_THE_APP_URL>'
export PEOPLECLAW_API_KEY='<ONE_TIME_pc_m2m_TOKEN_FROM_SYSTEM_CONNECT_CODEX>'

peopleclaw whoami
peopleclaw apps list
peopleclaw app inspect "$PEOPLECLAW_APP_ID"
```

Do **not** paste long-lived shared/static credentials into documentation. Every tenant/user should mint their own app-scoped key from the in-app setup page.

## Drop-in install (customer side)

```bash
# from a checkout of the PeopleClaw monorepo
node packages/agent-skill/bin/install.mjs --dest /path/to/customer-repo

# or, when published
npx -y @peopleclaw/agent-skill install --dest .
```

That writes `AGENTS.md`, `SKILL.md`, and `docs/peopleclaw-agent/{QUICKSTART,TROUBLESHOOTING}.md` into the target. Pass `--merge` to splice into an existing `AGENTS.md` between managed markers. After install, paste the tenant-specific config block from **System → Connect Codex** into your local shell/agent context; do not commit the token.

## Troubleshooting

- **No setup page / 404 in browser** — confirm you are using the App URL shape `/app/<APP_ID>/system/external-agent`, are signed in, and the App belongs to the selected tenant.
- **Key creation fails** — refresh the page and confirm the current tenant has access to that App. If it still fails, copy the API error from the toast/network response.
- **401 from CLI** — the token is missing, mistyped, revoked, or not being sent as `PEOPLECLAW_API_KEY` / `Authorization: Bearer …`. Mint a new key if the one-time token was lost.
- **403 from CLI** — the key does not have the required scope, is scoped to a different App, or the operation requires `--confirm` after a dry-run.
- **404 from CLI** — the App ID is wrong or the token belongs to another tenant/app.
- **Token lost** — PeopleClaw cannot reveal it again. Revoke the old key and create a new one.

## Hard guardrails (summary)

The external-agent surface is intentionally narrow. Coding agents using it **must not**:

- run raw SQL, write migrations, or edit schema files in a PeopleClaw repo;
- read, log, or exfiltrate secrets (`pc_m2m_…`, `pc_sk_…`, `shpca_…`, `shpss_…`, …);
- attempt cross-tenant access;
- perform destructive ops (`delete_*`, `reset_*`, `purge_*`) without an explicit per-target operator confirmation;
- bypass the CLI by scripting the admin UI;
- skip the mandatory dry-run-first workflow.

Full text and operator-side detail: [`packages/agent-skill/templates/AGENTS.md`](../../packages/agent-skill/templates/AGENTS.md).
