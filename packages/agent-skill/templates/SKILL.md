---
name: peopleclaw
description: Drive a PeopleClaw App from a coding agent (Codex/OpenClaw/Claude Code/Cursor) using the scoped @peopleclaw/cli. Use when the user mentions PeopleClaw, an App on app.peopleclaw.rollersoft.com.au, a pc_m2m_ key, or asks to add/edit App components / run an App action / chat with an App as an agent.
version: 0.1.0
---

# PeopleClaw external-agent skill

## When to use this skill

Trigger on any of:

- "PeopleClaw", "peopleclaw", `pc_m2m_…` key, `app.peopleclaw.rollersoft.com.au`.
- A request to add, edit, list, or inspect **App components** belonging to a PeopleClaw App.
- A request to talk to a PeopleClaw App as an agent (App chat).
- A request to run a named **App action** / `operation` on a PeopleClaw App.

Do **not** use this skill for: PeopleClaw platform code changes (that's a repo-engineering task, not an external-agent task), DB/schema/secrets work (out of scope), or anything inside `app.peopleclaw.rollersoft.com.au`'s admin UI (use the CLI instead).

## What to read first

Open `AGENTS.md` in this repo. It is the contract. Everything below is a 30-second summary; the contract is authoritative.

## The 30-second loop

```bash
# 0. Pre-flight
test -n "$PEOPLECLAW_API_KEY" || { echo "Need PEOPLECLAW_API_KEY"; exit 2; }

# 1. Auth
peopleclaw whoami --json

# 2. Pick app
peopleclaw apps list --json     # one app? use it. multiple? ask the operator.

# 3. Baseline
peopleclaw app inspect "$APP_ID" --json

# 4. Dry-run the change (default behaviour: NO --confirm)
peopleclaw app action "$APP_ID" <operation> --args '{...}' --json

# 5. Confirm only when intended
peopleclaw app action "$APP_ID" <operation> --args '{...}' \
  --confirm --dry-run=false --json

# 6. Verify
peopleclaw app inspect "$APP_ID" --json
```

## Hard rules (cribbed from AGENTS.md)

- No raw SQL, no migrations, no schema edits.
- No secret reads/exfil. Forward `pc_m2m_…` to the CLI; never log it.
- No cross-tenant access. One key = one tenant + one App.
- No destructive ops without an explicit, in-session "yes, delete X" from the operator.
- Always dry-run first. Always pass `--json` when parsing output.
- Surface the API's `audit` block when reporting back.

## Failure modes — fast triage

| Response | Meaning | Action |
|---|---|---|
| `401` | Key invalid / wrong base URL | Stop, report. |
| `403 insufficient_scope` | Missing scope (e.g. `component:write`) | Stop, report which scope. |
| `404 app_not_found` | Wrong appId / key not bound to it | Re-run `apps list`. |
| `429` | Rate-limited | One backoff, then stop. |

Anything else: capture the full JSON response (including `audit`) and report it verbatim.
