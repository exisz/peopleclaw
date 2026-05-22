# PeopleClaw external-agent — Troubleshooting

Fast recipes for the most common failure modes. Always check `peopleclaw whoami --json` first — it answers "is the key wired up at all?" in one call.

## `Missing API key. Run \`peopleclaw configure …\``

The CLI couldn't find a key from any source.

Resolution order:

1. `echo "${PEOPLECLAW_API_KEY:-unset}"` — is the env var actually exported in *this* shell?
2. `cat "${PEOPLECLAW_CONFIG:-$HOME/.peopleclaw/config.json}"` — does the config file exist and contain `apiKey`?
3. Re-run `peopleclaw configure --api-key pc_m2m_...`.

If the CLI works in your shell but your **agent** (Codex/OpenClaw/Claude Code) still says "Missing API key": the agent's process env doesn't inherit your shell. Add the env var to the agent's launcher config (Codex profile env, OpenClaw workspace env, Claude Code project env, `direnv`, etc.).

## `PeopleClaw API 401: …`

Auth was rejected by the server.

- Double-check `PEOPLECLAW_BASE_URL` — is the key for prod but you're hitting staging (or vice-versa)?
- Has the key been revoked? Check **App → Settings → External Agents** in the admin UI.
- Did you accidentally paste a non-`pc_m2m_` value (e.g. a session cookie)? Mint a fresh key.

## `PeopleClaw API 403: insufficient_scope`

The key is valid but doesn't have the scope the operation requires.

- **Don't** retry or try to route around it.
- Read which scope was missing from the response body (`error`, `requiredScopes`).
- Ask the operator to mint a new key with that scope, or to grant it to the existing key (App → Settings → External Agents → edit).

Common scope needs:

| You ran | Needs |
|---|---|
| `peopleclaw whoami` | `agent:read` |
| `peopleclaw apps list` | `app:read` |
| `peopleclaw app inspect` | `app:read` |
| `peopleclaw app action … create_app_component` | `component:write` |
| `peopleclaw app action … (read-only ops)` | `component:read` |
| `peopleclaw app chat` (dry-run) | `agent:read` |
| `peopleclaw app chat --confirm --dry-run=false` | scopes matching the actions the chat plans |

## `PeopleClaw API 404: app_not_found` (or similar)

Either the `<appId>` is wrong, or your key isn't bound to that App.

```bash
peopleclaw apps list --json | jq '.apps[].id'
```

Use one of those ids. If the list is empty, the key has no apps attached — the operator needs to bind it via the admin UI.

## `PeopleClaw API 429: …`

Rate limited. Sleep 5–15 s, retry **once**, then stop and report. Do not loop.

## Confirmed mutation "succeeded" but nothing changed

You probably confirmed against the wrong App / wrong tenant / wrong base URL.

```bash
peopleclaw whoami --json | jq '{tenant: .tenantId, agent: .externalAgent.name}'
peopleclaw apps list --json | jq '.apps[] | {id, name}'
```

Cross-check against what you see in the admin UI at the same `PEOPLECLAW_BASE_URL`.

## Codex / OpenClaw / Claude Code can't find `peopleclaw`

The binary isn't on the agent's `PATH`.

- If you installed with `npm i -g`: `which peopleclaw` in *the agent's* shell. If empty, the agent's `PATH` doesn't include the npm global bin (`npm bin -g`). Add it, or install per-project with `npx -y @peopleclaw/cli ...`.
- If you installed with `pnpm add -g`: same, but `pnpm bin -g`.

## `--args` parsing errors

The CLI requires valid JSON for `--args`. Wrap in single quotes so the shell doesn't eat the double quotes:

```bash
# good
peopleclaw app action "$APP_ID" create_app_component --args '{"name":"Hero"}'

# bad — shell strips the quotes
peopleclaw app action "$APP_ID" create_app_component --args {"name":"Hero"}
```

On Windows PowerShell, escape with backticks or use a heredoc/temp file.

## "I don't know which App to target"

Stop. Ask the operator. Never guess across multiple apps — that's a cross-tenant safety risk even when the key technically allows it.
