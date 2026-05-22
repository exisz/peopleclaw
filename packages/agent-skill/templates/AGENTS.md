<!-- PEOPLECLAW-AGENT-SKILL:BEGIN v0.1.0 -->
# AGENTS.md — PeopleClaw external agent guardrails

You are a coding agent working **on a PeopleClaw App** through the official external-agent surface. This file is the contract for that surface. Read it fully before any tool call that touches PeopleClaw.

PeopleClaw exposes **two** control surfaces:

1. **In-platform Chat** — used by App owners inside `app.peopleclaw.rollersoft.com.au`. You are not that.
2. **External coding agents via scoped CLI + API + this skill** — that is you. Your only allowed channel is the `peopleclaw` CLI (or, equivalently, the `/api/external-agent/*` HTTP endpoints with a `pc_m2m_…` key).

You are operating with a **scoped, app-bound API key**. You do **not** get raw DB access, raw SQL, migration powers, secret reads, billing access, or cross-tenant visibility — even if you think you need them. If a task seems to need any of those, stop and report instead of attempting workarounds.

---

## 1. Setup (do this once per environment)

```bash
# 1. Install the CLI
npm i -g @peopleclaw/cli          # or: pnpm add -g @peopleclaw/cli

# 2. Configure (writes ~/.peopleclaw/config.json, mode 0600)
peopleclaw configure \
  --base-url "$PEOPLECLAW_BASE_URL" \
  --api-key  "$PEOPLECLAW_API_KEY"

# 3. Sanity check
peopleclaw whoami --json
```

Environment contract:

| Var | Required | Default | Notes |
|---|---|---|---|
| `PEOPLECLAW_API_KEY` | **yes** | — | App-scoped key, format `pc_m2m_…`. Never log, never echo, never commit. |
| `PEOPLECLAW_BASE_URL` | no | `https://app.peopleclaw.rollersoft.com.au` | Override only for staging/test instances. |
| `PEOPLECLAW_CONFIG` | no | `~/.peopleclaw/config.json` | Override per-project to keep keys scoped to a single repo (e.g. `./.peopleclaw/config.json`). |

If `PEOPLECLAW_API_KEY` is missing or empty: **stop**. Ask the human operator to set it. Do not attempt to guess, recover from history, or read it out of `.env` files unless explicitly told to.

The CLI binary is also available as `pc` for short.

---

## 2. The only commands you may use

```text
peopleclaw whoami [--json]
peopleclaw apps list [--json]
peopleclaw app inspect <appId> [--json]
peopleclaw app chat    <appId> "<message>" [--session-id <id>] [--confirm] [--dry-run] [--json]
peopleclaw app action  <appId> <operation>  [--args '{"…":"…"}'] [--confirm] [--dry-run] [--json]
```

That is the entire surface. There is no `peopleclaw db`, no `peopleclaw sql`, no `peopleclaw secrets get`, no `peopleclaw deploy`. If you find yourself reaching for one, you are off the rails.

**Always pass `--json`** when you intend to parse output. Human text is best-effort and may change.

---

## 3. Safe action workflow (mandatory order)

Every task that mutates a PeopleClaw App **must** flow through these steps, in order:

1. **`whoami`** — confirm the key works and learn which scopes you actually have.
2. **`apps list`** — discover the app(s) the key can see. If exactly one, that's your `<appId>`. If zero, stop and report. If more than one, **ask the operator** which app to target. Do not guess.
3. **`app inspect <appId>`** — read the App's current state (name, components, counts). This is your baseline.
4. **Plan** — write a short plan describing the operation(s) you intend, the `--args` payload(s), and what success looks like. Show it to the operator if running interactively.
5. **Dry-run** — execute each mutating call with the default dry-run behaviour:
   ```bash
   peopleclaw app action <appId> create_app_component \
     --args '{"name":"Hero","kind":"section"}' --json
   ```
   (No `--confirm`, no `--dry-run=false`.) Read the response, especially `action.summary`, `action.diff`, and any `warnings`.
6. **Confirm only when intended** — only after the dry-run looks right, re-run with explicit confirmation:
   ```bash
   peopleclaw app action <appId> create_app_component \
     --args '{"name":"Hero","kind":"section"}' \
     --confirm --dry-run=false --json
   ```
7. **Verify** — re-run `app inspect <appId> --json` and assert the change you expected (e.g. component count went up by exactly 1, name matches).
8. **Summarise** — report what changed, the operation id / audit reference returned by the API, and link the operator to the App URL.

The same dry-run-first discipline applies to `peopleclaw app chat`. Chat defaults to dry-run; pass `--confirm --dry-run=false` only when the operator has agreed that chat may mutate state.

---

## 4. Guardrails (non-negotiable)

You **must not**:

- ❌ Run raw SQL, write migrations, or touch Prisma/Drizzle schema files in a PeopleClaw-owned repo. The external-agent surface intentionally does not expose this. If a task seems to require a schema change, escalate to the operator — it's a platform change, not an agent change.
- ❌ Read, print, log, exfiltrate, or copy any value beginning with `pc_m2m_`, `pc_sk_`, `shpca_`, `shpss_`, or anything resembling a secret. Treat secrets as opaque tokens you forward to the CLI, never as data.
- ❌ Attempt cross-tenant access. Your key is bound to one tenant + one App. `apps list` returning fewer apps than you expected is **not** a bug to work around.
- ❌ Run destructive operations (`delete_*`, `reset_*`, `purge_*`, anything similar) without an explicit, in-session confirmation from the operator that names the exact target. Even with `component:write` scope, deletion needs a fresh human "yes, delete component X".
- ❌ Use the in-platform admin UI by scripting Playwright/Puppeteer against `app.peopleclaw.rollersoft.com.au`. That bypasses the external-agent scope system and triggers abuse detection. Use the CLI.
- ❌ Skip the dry-run step "to save time". Dry-run is the audit trail and the safety net. It is mandatory.
- ❌ Add, modify, or remove API keys, scopes, or external-agent records. Key lifecycle is operator-only via the UI.

You **must**:

- ✅ Honour `403 insufficient_scope` responses. If you lack `component:write`, do not try to talk around it — report the missing scope to the operator.
- ✅ Treat any `429` as backoff; sleep and retry once, then stop and report.
- ✅ Surface the `audit` block from API responses when reporting back. Operators rely on it.
- ✅ Keep secrets in env vars, never in committed files. If you write a config file, it goes under `.peopleclaw/` and that path must be in `.gitignore`.

---

## 5. Troubleshooting cheatsheet

| Symptom | Likely cause | What to do |
|---|---|---|
| `Missing API key. Run \`peopleclaw configure …\`` | `PEOPLECLAW_API_KEY` unset and no config file | Ask operator to set the env var or run `peopleclaw configure`. |
| `PeopleClaw API 401: …` | Key is invalid, revoked, or for the wrong instance | Re-check `PEOPLECLAW_BASE_URL`. Ask operator to mint a new key. |
| `PeopleClaw API 403: insufficient_scope` | Key lacks the scope this op needs | Report which scope is missing. Do not retry. |
| `PeopleClaw API 404: app_not_found` | Wrong `<appId>`, or key not bound to that App | Re-run `peopleclaw apps list --json` and use one of the returned ids. |
| `PeopleClaw API 429: …` | Rate limit | Sleep 5–15s, retry once, then escalate. |
| `PEOPLECLAW_API_KEY` is set in the operator's shell but Codex/agent runner can't see it | Codex sandbox env not forwarding the var | Ask operator to add it to the agent runner's env (e.g. `codex` profile env, OpenClaw workspace env, Claude Code project env). |
| Confirmed mutation succeeded but `app inspect` shows no change | You confirmed against a different App, or a different tenant's instance | Verify `whoami` tenant + `apps list` ids match what you intended. |

---

## 6. When in doubt

Stop and ask. The PeopleClaw external-agent surface is intentionally narrow; "I'll just do it through another channel" is always the wrong answer. Report to the operator with: what you tried, the exact API response (including `audit` and `error`), and the smallest next step you'd take if approved.

<!-- PEOPLECLAW-AGENT-SKILL:END -->
