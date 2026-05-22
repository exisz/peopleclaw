# PeopleClaw external-agent — Quickstart

Hands-on walkthrough for a developer setting up a coding agent (Codex / OpenClaw / Claude Code / Cursor) to safely drive a PeopleClaw App.

## 0. Prerequisites

- Node ≥ 18 and `npm` (or `pnpm`).
- A PeopleClaw App you own or have access to.
- An **app-scoped external-agent API key** minted from `app.peopleclaw.rollersoft.com.au` → your App → **Settings → External Agents → New key**. Recommended scopes for a coding agent:
  - `agent:read`
  - `app:read`
  - `component:read`
  - `component:write` (only if the agent should be allowed to mutate)

The key looks like `pc_m2m_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`. Treat it like any other secret.

## 1. Install the CLI

```bash
npm  i  -g @peopleclaw/cli      # or
pnpm add -g @peopleclaw/cli
```

Verify:

```bash
peopleclaw --help
```

The binary is also available as `pc`.

## 2. Configure auth

Two equivalent options:

### Option A — Per-machine config file

```bash
peopleclaw configure \
  --base-url https://app.peopleclaw.rollersoft.com.au \
  --api-key  pc_m2m_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Writes `~/.peopleclaw/config.json` with `0600` permissions.

### Option B — Per-project / per-shell env vars

```bash
export PEOPLECLAW_BASE_URL=https://app.peopleclaw.rollersoft.com.au
export PEOPLECLAW_API_KEY=pc_m2m_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# optional: keep config scoped to this repo
export PEOPLECLAW_CONFIG="$PWD/.peopleclaw/config.json"
```

Add `.peopleclaw/` to `.gitignore` if you go with Option B's `PEOPLECLAW_CONFIG` override.

### Codex / OpenClaw / Claude Code specifics

The CLI runs in your shell, but the *agent* needs `PEOPLECLAW_API_KEY` visible in **its** environment. Make sure to add the env var to wherever the agent process is launched from (e.g. your `codex` profile, the OpenClaw workspace env, the Claude Code project settings, your `direnv` `.envrc`). If `peopleclaw whoami` works in your shell but the agent reports "Missing API key", that's an env-forwarding gap, not a CLI bug.

## 3. First call

```bash
peopleclaw whoami --json
```

Expected: a JSON object with `externalAgent.name`, your scopes, and the tenant id. If you get `401`, the key is wrong or revoked. If you get `Missing API key`, see step 2.

## 4. Discover your App

```bash
peopleclaw apps list --json
```

If you see exactly one `app.id`, that's your `APP_ID`. Save it:

```bash
export APP_ID=<app id from apps list>
peopleclaw app inspect "$APP_ID" --json
```

## 5. First safe change (dry-run → confirm)

```bash
# Dry-run — default behaviour, no state change
peopleclaw app action "$APP_ID" create_app_component \
  --args '{"name":"Smoke","kind":"section"}' --json
```

Read the response. It should describe what *would* happen (`action.summary`, `action.diff`, no real component created — re-run `app inspect` to confirm the count is unchanged).

```bash
# Confirm — actually create it
peopleclaw app action "$APP_ID" create_app_component \
  --args '{"name":"Smoke","kind":"section"}' \
  --confirm --dry-run=false --json
```

Verify:

```bash
peopleclaw app inspect "$APP_ID" --json | jq '.counts.components'
```

## 6. Wiring into your coding agent

Drop the `AGENTS.md` from this package into the root of the repo your agent works in. That file is auto-read by Codex, OpenClaw, Claude Code, Cursor (`.cursorrules`-style discovery), and any other AGENTS.md-aware tool. If your agent uses the **Skill** convention (OpenClaw / Claude Skills), also drop `SKILL.md` next to it.

Tell the agent: *"Read AGENTS.md, then perform <task> against the PeopleClaw App."* The skill takes over from there.

## 7. Next steps

- Read [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) when something breaks.
- The full safety contract is [`AGENTS.md`](./AGENTS.md).
- Platform-side smoke / E2E reference: [`docs/external-agent-cli-e2e.md`](https://github.com/exisz/peopleclaw/blob/main/docs/external-agent-cli-e2e.md) in the PeopleClaw repo.
