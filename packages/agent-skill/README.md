# @peopleclaw/agent-skill

Drop-in instruction package for **external coding agents** (Codex / OpenClaw / Claude Code / Cursor / any AGENTS.md-aware agent) that need to work on a PeopleClaw App through the scoped external-agent API.

This package teaches a coding agent how to:

1. Install and configure the `@peopleclaw/cli` (`peopleclaw` / `pc` binary).
2. Authenticate with a scoped, app-bound `pc_m2m_…` key.
3. Discover the App it is allowed to mutate.
4. Plan and execute **safe, dry-run-first** low-code changes (components, chat).
5. Stay inside the guardrails: no raw SQL, no migrations, no secrets exfiltration, no cross-tenant access, no destructive shortcuts.

> **Two control surfaces.** PeopleClaw is designed around two control surfaces: the in-platform Chat (for App owners) and external coding agents via the scoped CLI/API (for power users who want to drive PeopleClaw from Codex/OpenClaw/Cursor). This skill is the canonical onboarding for the second surface.

## What's in the box

| File | Purpose |
|---|---|
| `templates/AGENTS.md` | Drop-in `AGENTS.md` for the customer's repo. Read by Codex/OpenClaw/Claude Code/Cursor automatically. |
| `templates/SKILL.md` | OpenClaw/Claude `Skills`-style entry: how to recognise a PeopleClaw task and what to do. |
| `templates/QUICKSTART.md` | Human-readable onboarding (install → configure → first safe change). |
| `templates/TROUBLESHOOTING.md` | 401/403/scope/app-not-found/Codex-env-missing recipes. |
| `bin/install.mjs` | Copies the templates into a target directory; optional `--merge` mode appends to an existing AGENTS.md instead of overwriting. |

## Install into a customer repo

From any Node ≥ 18 environment with this monorepo checked out:

```bash
node packages/agent-skill/bin/install.mjs --dest /path/to/customer-repo
```

Or, when published:

```bash
npx -y @peopleclaw/agent-skill install --dest .
```

Flags:

- `--dest <dir>` — target directory (default: current working dir).
- `--merge` — if `AGENTS.md` already exists, append the PeopleClaw section under a managed marker instead of overwriting.
- `--force` — overwrite existing files unconditionally.
- `--no-skill` — skip `SKILL.md` (for agents that don't use the Skill convention).

## What the customer needs before running

1. A PeopleClaw account and an App they own (or were granted access to).
2. An app-scoped external-agent API key (`pc_m2m_…`) minted from **App → System → Connect Codex** (`/app/<APP_ID>/system/external-agent`). The page generates tenant/app-specific copy-paste config and reveals the token once. Recommended scopes for a coding agent:
   - `agent:read`
   - `app:read`
   - `component:read`
   - `component:write` (only if the agent should be allowed to create/update components)
3. Node ≥ 18 and `npm` or `pnpm`.

## Where to read more

- End-to-end CLI smoke + safety model: [`docs/external-agent-cli-e2e.md`](../../docs/external-agent-cli-e2e.md)
- CLI source / commands: [`packages/cli/src/index.ts`](../cli/src/index.ts)
- This skill's actual instruction text: [`templates/AGENTS.md`](./templates/AGENTS.md)
