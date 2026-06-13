# peopleclaw-vercel

Independent PeopleClaw Vercel CLI ecosystem plus a headless persistent broker server.

The broker keeps the real `VERCEL_TOKEN` server-side and issues customer `pcv_...` tokens with explicit repo/project allowlists. Access is deny-by-default and audited to JSONL.

## Server

```bash
cp packages/peopleclaw-vercel/.env.example packages/peopleclaw-vercel/.env
# edit .env; use real values only on the server
pnpm --filter @peopleclaw/vercel-broker build
PCV_HOST=0.0.0.0 PCV_PORT=8787 VERCEL_TOKEN=... PCV_ADMIN_SECRET=... \
  pnpm --filter @peopleclaw/vercel-broker start:server
curl http://127.0.0.1:8787/health
```

Endpoints:

- `GET /health` — no auth, liveness.
- `POST /admin/tokens` — admin bearer secret; issues a scoped customer token.
- `GET /admin/tokens` — admin bearer secret; lists redacted token records.
- `POST /admin/tokens/:id/revoke` — admin bearer secret; soft-revokes a token.
- `GET /whoami` — customer bearer token; shows token scope.
- `GET /projects` — customer bearer token; forwards to Vercel and filters to allowlist.
- `GET /deployments` — customer bearer token; forwards to Vercel and filters to allowlist.
- `/api/vercel/*` — advanced scoped proxy for allowlisted Vercel REST paths.

Issue a Skin Spirit-scoped key:

```bash
curl -X POST https://broker.example.com/admin/tokens \
  -H "Authorization: Bearer $PCV_ADMIN_SECRET" \
  -H 'content-type: application/json' \
  -d '{
    "label":"skin-spirit-agent",
    "allowedProjects":["skin-spirit"],
    "allowedRepos":["exisz/skin-spirit"]
  }'
```

If exact Skin Spirit Vercel project/repo slugs differ, replace them explicitly at issue time. Do **not** broaden to all projects.

## CLI

```bash
pnpm --filter @peopleclaw/vercel-broker build
pnpm --filter @peopleclaw/vercel-broker exec pcv login --broker-url https://broker.example.com --token pcv_xxx.yyy
pcv whoami
pcv projects list --limit 20
pcv deployments list --projectId skin-spirit --limit 20
pcv admin issue-key --admin-secret "$PCV_ADMIN_SECRET" --label skin-spirit-agent --project skin-spirit --repo exisz/skin-spirit
```

CLI config is stored at `~/.config/peopleclaw-vercel/config.json` mode `0600`. `--broker-url`, `--token`, `PCV_BROKER_URL`, and `PCV_TOKEN` override config.

## Agent Workspace template

See `templates/agent-workspace/`.

Standard:

- Root repo is the agent workspace.
- `repos/` contains Git submodules for the customer/application repos.
- Non-sensitive env/config files are committed plainly.
- `secrets/` contains local-only secret references/examples.
- Real secrets must not be plaintext committed unless intentionally local/private; broker/server vault is preferred.

## Docker / Dokploy

```bash
cd packages/peopleclaw-vercel
cp .env.example .env
# edit VERCEL_TOKEN, PCV_ADMIN_SECRET, PCV_PUBLIC_URL
docker compose up -d --build
curl http://127.0.0.1:8787/health
```

Dokploy: create a Docker Compose app pointed at this repository, compose file `packages/peopleclaw-vercel/docker-compose.yml`, and set the same environment values as `.env.example`. Mount `/data` persistently.

No production broker is deployed by this package by default because deployment requires a real server-side Vercel token and final DNS/Dokploy target choice.

## Security notes

- Never commit `VERCEL_TOKEN`, admin secrets, or customer tokens.
- Broker audit logs intentionally record token id/label and request path/status, never upstream token values.
- Customer tokens with empty allowlists cannot list or access Vercel project/deployment data.
- List endpoints filter upstream Vercel responses to the token allowlist.

## Generic GitHub App workspace commands

`pcv` can mint scoped GitHub App installation tokens and configure local workspace repo remotes. This is generic workspace scaffolding behavior; product workspaces should keep only config/secrets and call these commands from npm scripts.

Required config can be passed as flags or environment variables:

```bash
GITHUB_APP_ID=4043465
GITHUB_APP_INSTALLATION_ID=140017718
GITHUB_APP_PRIVATE_KEY_PATH=secrets/peopleclaw-main.github-app.private-key.pem
GITHUB_APP_REPOS=exisz/roller-beauty,exisz/beauty-consult-pwa
# Optional JSON override. Defaults to contents/write, metadata/read, actions/write,
# issues/write, pull_requests/write, secrets/write, workflows/write.
GITHUB_APP_PERMISSIONS='{"contents":"write","metadata":"read","actions":"write","issues":"write","pull_requests":"write","secrets":"write","workflows":"write"}'
```

Commands:

```bash
# Print a short-lived installation token to stdout.
pcv github token

# Write secrets/github-token.txt and secrets/github-app-token.json with mode 0600.
pcv github token --write

# Configure origin remotes for each repo in the allowlist.
# Default mapping: owner/repo -> repos/<repo-name> under the current directory.
pcv github configure-remotes

# Mint/write token, then configure remotes in one step.
pcv github refresh
```

Useful flags: `--app-id`, `--installation-id`, `--private-key-path`, `--repos`, `--permissions`, `--secrets-dir`, `--root`, and `--token-file`.

Safety rules:

- Keep `GITHUB_APP_REPOS` narrow; the CLI requests tokens for only the configured allowlist.
- Do not commit `secrets/github-token.txt`, `secrets/github-app-token.json`, or private keys.
- Prefer `pcv github refresh` in workspace scripts instead of product-specific token scripts.
