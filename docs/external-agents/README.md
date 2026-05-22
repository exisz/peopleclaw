# PeopleClaw — External Coding Agents (Codex / OpenClaw / Claude Code / Cursor)

PeopleClaw exposes **two** control surfaces:

1. **In-platform Chat** — the App owner talks to their App inside `app.peopleclaw.rollersoft.com.au`.
2. **External coding agents** — a developer drives an App from their own coding agent (Codex / OpenClaw / Claude Code / Cursor) through the scoped CLI + API.

This index points at all the resources for surface #2.

## Resources

| Resource | Audience | Path |
|---|---|---|
| **`@peopleclaw/cli`** — the only allowed channel for external agents | Developers + agents | [`packages/cli/`](../../packages/cli/) |
| **`@peopleclaw/agent-skill`** — drop-in `AGENTS.md` + `SKILL.md` package | Customers wiring up their own coding agent | [`packages/agent-skill/`](../../packages/agent-skill/) |
| **Quickstart** — install → configure → first safe change | Developers | [`packages/agent-skill/templates/QUICKSTART.md`](../../packages/agent-skill/templates/QUICKSTART.md) |
| **AGENTS.md template** — the safety contract | Coding agents | [`packages/agent-skill/templates/AGENTS.md`](../../packages/agent-skill/templates/AGENTS.md) |
| **SKILL.md template** — Skill-convention entry | OpenClaw / Claude Skills agents | [`packages/agent-skill/templates/SKILL.md`](../../packages/agent-skill/templates/SKILL.md) |
| **Troubleshooting** | Developers | [`packages/agent-skill/templates/TROUBLESHOOTING.md`](../../packages/agent-skill/templates/TROUBLESHOOTING.md) |
| **CLI E2E smoke + safety model** | Platform engineers + QA | [`external-agent-cli-e2e.md`](./external-agent-cli-e2e.md) |

## Drop-in install (customer side)

```bash
# from a checkout of the PeopleClaw monorepo
node packages/agent-skill/bin/install.mjs --dest /path/to/customer-repo

# or, when published
npx -y @peopleclaw/agent-skill install --dest .
```

That writes `AGENTS.md`, `SKILL.md`, and `docs/peopleclaw-agent/{QUICKSTART,TROUBLESHOOTING}.md` into the target. Pass `--merge` to splice into an existing `AGENTS.md` between managed markers.

## Hard guardrails (summary)

The external-agent surface is intentionally narrow. Coding agents using it **must not**:

- run raw SQL, write migrations, or edit schema files in a PeopleClaw repo;
- read, log, or exfiltrate secrets (`pc_m2m_…`, `pc_sk_…`, `shpca_…`, `shpss_…`, …);
- attempt cross-tenant access;
- perform destructive ops (`delete_*`, `reset_*`, `purge_*`) without an explicit per-target operator confirmation;
- bypass the CLI by scripting the admin UI;
- skip the mandatory dry-run-first workflow.

Full text and operator-side detail: [`packages/agent-skill/templates/AGENTS.md`](../../packages/agent-skill/templates/AGENTS.md).
